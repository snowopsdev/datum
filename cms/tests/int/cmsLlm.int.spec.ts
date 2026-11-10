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
  it('is the workspace rule: MOCK_MODE wins, else live only when any provider key is set', () => {
    const cases: [Record<string, string | undefined>, boolean][] = [
      [{}, true],
      [{ ANTHROPIC_API_KEY: 'k' }, false],
      [{ OPENAI_API_KEY: 'k' }, false],
      [{ ANTHROPIC_API_KEY: 'k', MOCK_MODE: 'true' }, true],
      [{ ANTHROPIC_API_KEY: 'k', MOCK_MODE: '1' }, true],
      [{ MOCK_MODE: 'false' }, false],
      [{ MOCK_MODE: 'NO' }, false],
      [{ MOCK_MODE: '' }, true],
      [{ MOCK_MODE: '  ', OPENAI_API_KEY: 'k' }, false],
      // Unparseable: mock, even with a key. The readiness check reports it.
      [{ MOCK_MODE: 'maybe', ANTHROPIC_API_KEY: 'k' }, true],
    ]
    for (const [env, expected] of cases) {
      expect(cmsMockMode(env, ANTHROPIC_MODEL), JSON.stringify(env)).toBe(expected)
      // The mode belongs to the workspace, not to the model asked about.
      expect(cmsMockMode(env, OPENAI_MODEL), JSON.stringify(env)).toBe(expected)
    }
  })

  it('never goes live on anything but a provider key or an explicit false', () => {
    expect(cmsMockMode({ SOME_OTHER_CREDENTIAL: 'present' }, ANTHROPIC_MODEL)).toBe(true)
    expect(cmsMockMode({ ANTHROPIC_API_KEY: '' }, ANTHROPIC_MODEL)).toBe(true)
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
      { env: { MOCK_MODE: 'false', ANTHROPIC_API_KEY: 'k' } },
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
      { env: { MOCK_MODE: 'false', OPENAI_API_KEY: 'k' } },
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

  it('in live mode without that model\'s key, fails naming the key and never calls out', async () => {
    // Live because the other provider's key is set; this model's key is not.
    await expect(
      completeJsonCms(
        { system: 's', user: 'u', model: OPENAI_MODEL, label: 'Setup assistant' },
        { env: { ANTHROPIC_API_KEY: 'k' } },
      ),
    ).rejects.toThrow(/Setup assistant cannot run: "gpt-5\.6-terra" needs OPENAI_API_KEY set/)
    await expect(
      completeJsonCms(
        { system: 's', user: 'u', model: ANTHROPIC_MODEL },
        { env: { MOCK_MODE: 'false' } },
      ),
    ).rejects.toThrow(/needs ANTHROPIC_API_KEY set/)
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('names the token cap when a cut-off reply is not valid JSON', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"a": [1, 2' }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 5, output_tokens: 8000 },
    })
    const failure = await completeJsonCms(
      { system: 's', user: 'u', model: ANTHROPIC_MODEL },
      { env: { ANTHROPIC_API_KEY: 'k' } },
    ).then(
      () => null,
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(CmsLlmError)
    expect((failure as CmsLlmError).message).toMatch(/not valid JSON \(did not finish normally; stop_reason: max_tokens\)/)
    expect((failure as CmsLlmError).billed.usage).toEqual({ inputTokens: 5, outputTokens: 8000 })
  })

  it('names a refusal instead of calling it malformed JSON', async () => {
    anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot help with that.' }],
      stop_reason: 'refusal',
      usage: { input_tokens: 5, output_tokens: 9 },
    })
    await expect(
      completeJsonCms({ system: 's', user: 'u', model: ANTHROPIC_MODEL }, { env: { ANTHROPIC_API_KEY: 'k' } }),
    ).rejects.toThrow(/stop_reason: refusal/)
  })

  it('refuses a model id neither provider serves instead of guessing one', async () => {
    await expect(
      completeJsonCms(
        { system: 'sys', user: 'usr', model: 'codex/gpt-5.6-terra' },
        { env: { MOCK_MODE: 'false' } },
      ),
    ).rejects.toThrow(/not an Anthropic or OpenAI model id/)
    expect(anthropicCreate).not.toHaveBeenCalled()
    expect(openaiCreate).not.toHaveBeenCalled()
  })

  it('throws a billed CmsLlmError when the reply is empty', async () => {
    anthropicCreate.mockResolvedValue({
      content: [],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 99, output_tokens: 0 },
    })
    const failure = await completeJsonCms(
      { system: 'sys', user: 'usr', model: ANTHROPIC_MODEL, label: 'Draft step' },
      { env: { MOCK_MODE: 'false', ANTHROPIC_API_KEY: 'k' } },
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
      { env: { MOCK_MODE: 'false', OPENAI_API_KEY: 'k' } },
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
