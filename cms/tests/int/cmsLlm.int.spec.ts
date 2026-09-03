import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const anthropicCreate = vi.fn()
const openaiCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: anthropicCreate }
  },
}))

vi.mock('openai', () => ({
  default: class {
    responses = { create: openaiCreate }
  },
}))

import { CmsLlmError, cmsMockMode, completeJsonCms, logCmsCost } from '@/lib/cmsLlm'

const ANTHROPIC_MODEL = 'claude-opus-5'
const OPENAI_MODEL = 'gpt-5.6-terra'
const CODEX_MODEL = 'codex/gpt-5.6-terra'

const anthropicReply = (text: string) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 12, output_tokens: 34 },
})

const openaiReply = (text: string) => ({
  output_text: text,
  status: 'completed',
  usage: { input_tokens: 7, output_tokens: 8 },
})

beforeEach(() => {
  anthropicCreate.mockReset()
  openaiCreate.mockReset()
})

describe('cmsMockMode', () => {
  it('lets MOCK_MODE win, and otherwise mocks when the model credential is absent', () => {
    const cases: [Record<string, string | undefined>, string, boolean][] = [
      [{}, ANTHROPIC_MODEL, true],
      [{ ANTHROPIC_API_KEY: 'k' }, ANTHROPIC_MODEL, false],
      [{ ANTHROPIC_API_KEY: 'k', MOCK_MODE: 'true' }, ANTHROPIC_MODEL, true],
      [{ MOCK_MODE: 'false' }, ANTHROPIC_MODEL, false],
      [{ MOCK_MODE: '' }, ANTHROPIC_MODEL, true],
      // The credential is picked per model, not per workspace: an Anthropic key
      // does nothing for a gpt-* id and vice versa.
      [{ OPENAI_API_KEY: 'k' }, OPENAI_MODEL, false],
      [{ ANTHROPIC_API_KEY: 'k' }, OPENAI_MODEL, true],
      [{ OPENAI_API_KEY: 'k' }, ANTHROPIC_MODEL, true],
    ]
    for (const [env, model, expected] of cases) {
      expect(cmsMockMode(env, model), `${model} with ${JSON.stringify(env)}`).toBe(expected)
    }
  })

  it('never goes live on a bare Codex login', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'datum-cmsllm-codex-'))
    try {
      expect(cmsMockMode({ CODEX_HOME: home }, CODEX_MODEL)).toBe(true)
      writeFileSync(path.join(home, 'auth.json'), '{}')
      // A login is not consent to spend the plan; only an explicit MOCK_MODE=false is.
      expect(cmsMockMode({ CODEX_HOME: home }, CODEX_MODEL)).toBe(true)
      expect(cmsMockMode({ CODEX_HOME: home, MOCK_MODE: 'false' }, CODEX_MODEL)).toBe(false)
    } finally {
      rmSync(home, { force: true, recursive: true })
    }
  })
})

describe('completeJsonCms', () => {
  it('refuses to run in mock mode instead of inventing a reply', async () => {
    await expect(
      completeJsonCms({ system: 's', user: 'u', model: ANTHROPIC_MODEL }, { env: { MOCK_MODE: 'true' } }),
    ).rejects.toThrow(/mock mode/)
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('calls Anthropic for a claude-* model and returns the parsed JSON with usage', async () => {
    anthropicCreate.mockResolvedValue(anthropicReply('```json\n{"ok":true}\n```'))
    const result = await completeJsonCms(
      { system: 'sys', user: 'usr', model: ANTHROPIC_MODEL, maxTokens: 1234 },
      { env: { MOCK_MODE: 'false' } },
    )
    expect(result.json).toEqual({ ok: true })
    expect(result.provider).toBe('anthropic')
    expect(result.model).toBe(ANTHROPIC_MODEL)
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 34 })
    expect(anthropicCreate).toHaveBeenCalledWith({
      model: ANTHROPIC_MODEL,
      max_tokens: 1234,
      system: 'sys',
      messages: [{ role: 'user', content: 'usr' }],
    })
  })

  it('calls OpenAI in JSON mode for a gpt-* model', async () => {
    openaiCreate.mockResolvedValue(openaiReply('{"ok":1}'))
    const result = await completeJsonCms(
      { system: 'sys', user: 'usr', model: OPENAI_MODEL },
      { env: { MOCK_MODE: 'false' } },
    )
    expect(result.json).toEqual({ ok: 1 })
    expect(result.provider).toBe('openai')
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 8 })
    expect(openaiCreate.mock.calls[0][0]).toMatchObject({
      model: OPENAI_MODEL,
      instructions: 'sys',
      input: 'usr',
      max_output_tokens: 8000,
      text: { format: { type: 'json_object' } },
    })
  })

  it('routes a codex/ model through the injected CLI and bills the prefixed id', async () => {
    const result = await completeJsonCms(
      { system: 'sys', user: 'usr', model: CODEX_MODEL },
      {
        env: { MOCK_MODE: 'false' },
        completeViaCodex: async (req) => {
          expect(req.model).toBe(CODEX_MODEL)
          return {
            text: '{"ok":true}',
            usage: { inputTokens: 3, outputTokens: 4, webSearchRequests: 0 },
            model: req.model,
          }
        },
      },
    )
    expect(result.provider).toBe('codex')
    expect(result.model).toBe(CODEX_MODEL)
    expect(result.usage).toEqual({ inputTokens: 3, outputTokens: 4 })
  })

  it('throws a billed CmsLlmError when the reply is empty', async () => {
    anthropicCreate.mockResolvedValue({
      content: [],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 99, output_tokens: 0 },
    })
    const failure = await completeJsonCms(
      { system: 'sys', user: 'usr', model: ANTHROPIC_MODEL, label: 'Draft step' },
      { env: { MOCK_MODE: 'false' } },
    ).then(
      () => null,
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(CmsLlmError)
    expect((failure as CmsLlmError).message).toBe('Draft step returned no text (stop_reason: max_tokens)')
    expect((failure as CmsLlmError).billed).toEqual({
      provider: 'anthropic',
      model: ANTHROPIC_MODEL,
      usage: { inputTokens: 99, outputTokens: 0 },
    })
  })

  it('throws a billed CmsLlmError when the reply is not JSON', async () => {
    openaiCreate.mockResolvedValue(openaiReply('Sorry, I cannot help with that.'))
    const failure = await completeJsonCms(
      { system: 'sys', user: 'usr', model: OPENAI_MODEL },
      { env: { MOCK_MODE: 'false' } },
    ).then(
      () => null,
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(CmsLlmError)
    expect((failure as CmsLlmError).message).toMatch(/not valid JSON: Sorry, I cannot help/)
    // The call was still charged, so the caller can log the spend it caused.
    expect((failure as CmsLlmError).billed).toEqual({
      provider: 'openai',
      model: OPENAI_MODEL,
      usage: { inputTokens: 7, outputTokens: 8 },
    })
  })
})

describe('logCmsCost', () => {
  it('writes one cost-log row with the stage and priced usage it was given', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    await logCmsCost({ create } as never, {
      runId: 'brand-voice-extract:abc',
      stage: 'brandVoiceExtract',
      provider: 'anthropic',
      model: 'claude-opus-5',
      usage: { inputTokens: 1_000_000, outputTokens: 0 },
      request: { filename: 'guide.md' },
      response: { warnings: [] },
    })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'cost-log',
        overrideAccess: true,
        data: expect.objectContaining({
          pipelineRunId: 'brand-voice-extract:abc',
          stage: 'brandVoiceExtract',
          provider: 'anthropic',
          model: 'claude-opus-5',
          inputTokens: 1_000_000,
          outputTokens: 0,
          webSearchRequests: 0,
          costUsd: 5,
          request: { filename: 'guide.md' },
          response: { warnings: [] },
        }),
      }),
    )
  })

  it('carries a non-extraction stage through unchanged', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })
    await logCmsCost({ create } as never, {
      runId: 'run-1',
      stage: 'generate',
      provider: 'mock',
      model: 'claude-opus-5',
      usage: { inputTokens: 0, outputTokens: 0 },
      request: { note: 'mock' },
      response: null,
    })
    expect(create.mock.calls[0][0].data).toMatchObject({ stage: 'generate', provider: 'mock', costUsd: 0 })
  })
})
