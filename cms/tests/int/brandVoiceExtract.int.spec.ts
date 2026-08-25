import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

const fixture = (name: string) => path.join(__dirname, '..', 'fixtures', name)

import {
  BrandVoiceExtractionError,
  extractBrandVoiceFromText,
  extractionMockMode,
  extractionModel,
  logExtractionCost,
} from '@/lib/brandVoiceExtract'
import { BRAND_VOICE_FIXTURE } from '@/lib/brandVoiceFixture'
import { detectKind, extractText, MAX_EXTRACT_CHARS, UnsupportedUploadError } from '@/lib/extractText'

describe('extractText', () => {
  it('detects the kind by extension first, then by mimetype', () => {
    expect(detectKind('guide.md', 'application/octet-stream')).toBe('md')
    expect(detectKind('GUIDE.PDF', '')).toBe('pdf')
    expect(detectKind('guide.docx', '')).toBe('docx')
    expect(detectKind('notes', 'text/plain; charset=utf-8')).toBe('txt')
    expect(detectKind('archive.zip', 'application/zip')).toBeNull()
  })

  it('reads markdown and text verbatim, normalising line endings', async () => {
    const md = await extractText(Buffer.from('# Voice\r\n\r\n\r\n\r\nWe are plain.  \r\n'), '', 'guide.md')
    expect(md).toEqual({ text: '# Voice\n\nWe are plain.', kind: 'md', truncated: false, sourceChars: 22 })
    const txt = await extractText(Buffer.from('hello'), 'text/plain', 'notes.txt')
    expect(txt.kind).toBe('txt')
  })

  it('extracts text from real PDF and DOCX files', async () => {
    const pdf = await extractText(readFileSync(fixture('brand-guide.pdf')), 'application/pdf', 'brand-guide.pdf')
    expect(pdf.kind).toBe('pdf')
    expect(pdf.text).toContain('Acme Brand Guide')
    expect(pdf.text).toContain('Never use synergy.')

    const docx = await extractText(readFileSync(fixture('brand-guide.docx')), '', 'brand-guide.docx')
    expect(docx.kind).toBe('docx')
    expect(docx.text).toBe('Acme Brand Guide\n\nWe are plain-spoken and warm. Never use synergy.')
  })

  it('truncates very long sources and reports the original length', async () => {
    const long = 'a'.repeat(MAX_EXTRACT_CHARS + 10)
    const result = await extractText(Buffer.from(long), 'text/plain', 'long.txt')
    expect(result.truncated).toBe(true)
    expect(result.text).toHaveLength(MAX_EXTRACT_CHARS)
    expect(result.sourceChars).toBe(MAX_EXTRACT_CHARS + 10)
  })

  it('rejects unsupported uploads with a readable error', async () => {
    await expect(extractText(Buffer.from(''), 'image/png', 'logo.png')).rejects.toBeInstanceOf(
      UnsupportedUploadError,
    )
    await expect(extractText(Buffer.from(''), 'image/png', 'logo.png')).rejects.toThrow(/\.md, \.txt, \.pdf, \.docx/)
  })
})

describe('brand voice extraction', () => {
  it('follows the pipeline mock rule: MOCK_MODE wins, else mock without the model provider key', () => {
    expect(extractionMockMode({})).toBe(true)
    expect(extractionMockMode({ ANTHROPIC_API_KEY: 'k' })).toBe(false)
    expect(extractionMockMode({ ANTHROPIC_API_KEY: 'k', MOCK_MODE: 'true' })).toBe(true)
    expect(extractionMockMode({ MOCK_MODE: 'false' })).toBe(false)
    expect(extractionModel({})).toBe('claude-opus-5')
    expect(extractionModel({ BRAND_VOICE_EXTRACT_MODEL: 'claude-sonnet-5' })).toBe('claude-sonnet-5')
    expect(
      extractionModel({ BRAND_VOICE_EXTRACT_MODEL: 'claude-sonnet-5' }, { brandVoiceExtractModel: 'gpt-5.6-terra' }),
    ).toBe('gpt-5.6-terra')
  })

  it('mocks or not based on the model actually passed in, not just the env default', () => {
    expect(extractionMockMode({ OPENAI_API_KEY: 'k' }, 'gpt-5.6-sol')).toBe(false)
    expect(extractionMockMode({ ANTHROPIC_API_KEY: 'k' }, 'gpt-5.6-sol')).toBe(true)
  })

  it('needs the OpenAI key, not the Anthropic one, when the extraction model is a gpt-* id', () => {
    expect(extractionMockMode({ OPENAI_API_KEY: 'k', BRAND_VOICE_EXTRACT_MODEL: 'gpt-5' })).toBe(false)
    expect(extractionMockMode({ ANTHROPIC_API_KEY: 'k', BRAND_VOICE_EXTRACT_MODEL: 'gpt-5' })).toBe(true)
    expect(extractionMockMode({ OPENAI_API_KEY: 'k' })).toBe(true)
  })

  it('returns the demo fixture in mock mode without touching the network', async () => {
    vi.stubEnv('MOCK_MODE', 'true')
    try {
      const result = await extractBrandVoiceFromText({ text: 'anything', filename: 'acme-brand-guide.pdf' })
      expect(result.provider).toBe('mock')
      expect(result.content.name).toBe('acme brand guide (extracted)')
      expect(result.content.coreValues).toEqual(BRAND_VOICE_FIXTURE.coreValues)
      expect(result.warnings[0]).toMatch(/Mock mode/)
      expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('still logs spend for a billed call whose reply was unusable', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    const failure = new BrandVoiceExtractionError('not json', {
      provider: 'anthropic',
      model: 'claude-opus-5',
      usage: { inputTokens: 200_000, outputTokens: 0 },
    })
    await logExtractionCost({ create } as never, 'brand-voice-extract:x', failure.billed, {
      filename: 'guide.pdf',
      sourceChars: 10,
    })
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ costUsd: 1, response: { error: 'reply unusable; see server log' } }),
    )
  })

  it('logs one cost-log row per extraction with the brandVoiceExtract stage', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    await logExtractionCost(
      { create } as never,
      'brand-voice-extract:abc',
      {
        content: BRAND_VOICE_FIXTURE,
        warnings: [],
        provider: 'anthropic',
        model: 'claude-opus-5',
        usage: { inputTokens: 1_000_000, outputTokens: 0 },
      },
      { filename: 'guide.md', sourceChars: 120 },
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cost-log',
        overrideAccess: true,
        data: expect.objectContaining({
          pipelineRunId: 'brand-voice-extract:abc',
          stage: 'brandVoiceExtract',
          model: 'claude-opus-5',
          costUsd: 5,
          request: { filename: 'guide.md', sourceChars: 120 },
        }),
      }),
    )
  })
})
