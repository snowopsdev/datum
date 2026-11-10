import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Payload } from 'payload'

import {
  anthropicReplyText,
  CostLogWriteError,
  completeJSONLogged,
  createLlmClient,
  type CostContext,
  LlmReplyError,
  type LlmSdkClients,
  webSearchToolFor,
} from '../src/llm'

const USAGE = { input_tokens: 120, output_tokens: 340 }

/** A fake Anthropic SDK whose `messages.create` returns the queued replies. */
function fakeAnthropic(reply: unknown, seen: unknown[] = []): LlmSdkClients {
  return {
    anthropic: {
      messages: {
        create: async (params: unknown) => {
          seen.push(params)
          return reply
        },
      },
    } as unknown as LlmSdkClients['anthropic'],
  }
}

function fakeOpenAI(reply: unknown): LlmSdkClients {
  return {
    openai: { responses: { create: async () => reply } } as unknown as LlmSdkClients['openai'],
  }
}

const anthropicReply = (over: Record<string, unknown>) => ({
  content: [{ type: 'text', text: '{"ok":true}' }],
  stop_reason: 'end_turn',
  stop_details: null,
  usage: USAGE,
  ...over,
})

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => assert.fail('expected a rejection'),
    (error: unknown) => error,
  )
}

const call = (sdk: LlmSdkClients, model = 'claude-opus-5', needWebSearch = false) =>
  createLlmClient('live', sdk).completeJSON('generate', { system: 's', user: 'u', needWebSearch }, model)

describe('Anthropic reply errors carry what was billed', () => {
  const billed = {
    provider: 'anthropic',
    model: 'claude-opus-5',
    usage: { inputTokens: 120, outputTokens: 340, webSearchRequests: 2 },
  }
  const usage = { ...USAGE, server_tool_use: { web_search_requests: 2 } }

  it('names max_tokens', async () => {
    const error = await rejection(
      call(fakeAnthropic(anthropicReply({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a":' }], usage }))),
    )
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'max_tokens')
    assert.match(error.message, /truncated at max_tokens/)
    assert.deepEqual(error.billed, billed)
  })

  it('names a refusal and its category', async () => {
    const error = await rejection(
      call(
        fakeAnthropic(
          anthropicReply({
            stop_reason: 'refusal',
            content: [],
            stop_details: { type: 'refusal', category: 'cyber', explanation: 'declined' },
            usage,
          }),
        ),
      ),
    )
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'refusal')
    assert.match(error.message, /refused.*category: cyber/)
    assert.deepEqual(error.billed, billed)
  })

  it('names pause_turn', async () => {
    const error = await rejection(call(fakeAnthropic(anthropicReply({ stop_reason: 'pause_turn', usage }))))
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'pause_turn')
    assert.match(error.message, /pause_turn/)
  })

  it('names a reply with no text block', async () => {
    const error = await rejection(call(fakeAnthropic(anthropicReply({ content: [], usage }))))
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'no_text')
    assert.deepEqual(error.billed, billed)
  })

  it('keeps usage on a reply that is not JSON', async () => {
    const error = await rejection(
      call(fakeAnthropic(anthropicReply({ content: [{ type: 'text', text: 'Sorry, no.' }], usage }))),
    )
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'invalid_json')
    assert.match(error.message, /not valid JSON/)
    assert.deepEqual(error.billed, billed)
  })
})

describe('OpenAI reply errors carry what was billed', () => {
  const response = (over: Record<string, unknown>) => ({
    output_text: '{"ok":true}',
    status: 'completed',
    incomplete_details: null,
    output: [{ type: 'web_search_call' }],
    usage: { input_tokens: 7, output_tokens: 8 },
    ...over,
  })
  const billed = {
    provider: 'openai',
    model: 'gpt-5.6-terra',
    usage: { inputTokens: 7, outputTokens: 8, webSearchRequests: 1 },
  }

  it('names an incomplete reply', async () => {
    const error = await rejection(
      call(
        fakeOpenAI(
          response({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output_text: '{"a":' }),
        ),
        'gpt-5.6-terra',
      ),
    )
    assert.ok(error instanceof LlmReplyError)
    assert.equal(error.code, 'incomplete')
    assert.match(error.message, /truncated.*max_output_tokens/)
    assert.deepEqual(error.billed, billed)
  })

  it('names an empty reply and a non-JSON reply', async () => {
    const empty = await rejection(call(fakeOpenAI(response({ output_text: '' })), 'gpt-5.6-terra'))
    assert.ok(empty instanceof LlmReplyError)
    assert.equal(empty.code, 'no_text')
    assert.deepEqual(empty.billed, billed)
    const bad = await rejection(call(fakeOpenAI(response({ output_text: 'nope' })), 'gpt-5.6-terra'))
    assert.ok(bad instanceof LlmReplyError)
    assert.equal(bad.code, 'invalid_json')
    assert.deepEqual(bad.billed, billed)
  })
})

describe('anthropicReplyText', () => {
  it('joins the text blocks that follow the last tool result', () => {
    const text = anthropicReplyText([
      { type: 'text', text: 'Let me search.' },
      { type: 'server_tool_use' },
      { type: 'web_search_tool_result' },
      { type: 'text', text: '{"claims": [' },
      { type: 'text', text: '{"id": 1}' },
      { type: 'text', text: ']}' },
    ])
    assert.equal(text, '{"claims": [{"id": 1}]}')
  })

  it('ignores thinking blocks and keeps every text block when there is no tool', () => {
    assert.equal(
      anthropicReplyText([
        { type: 'thinking' },
        { type: 'text', text: '{"a":' },
        { type: 'text', text: '1}' },
      ]),
      '{"a":1}',
    )
  })

  it('parses a search reply whose JSON is split across cited blocks', async () => {
    const result = await call(
      fakeAnthropic(
        anthropicReply({
          content: [
            { type: 'text', text: 'Searching' },
            { type: 'web_search_tool_result' },
            { type: 'text', text: '{"verdicts": [' },
            { type: 'text', text: '"supported"]}' },
          ],
        }),
      ),
      'claude-opus-5',
      true,
    )
    assert.deepEqual(result.json, { verdicts: ['supported'] })
  })
})

describe('webSearchToolFor', () => {
  it('uses the dynamic-filtering tool only on models that serve it', () => {
    for (const model of ['claude-fable-5', 'claude-opus-5', 'claude-opus-5-5', 'claude-opus-4-6', 'claude-sonnet-5', 'claude-sonnet-5-5', 'claude-sonnet-4-6']) {
      assert.equal(webSearchToolFor(model).type, 'web_search_20260209', model)
    }
    for (const model of ['claude-haiku-4-5', 'claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-5-5']) {
      assert.equal(webSearchToolFor(model).type, 'web_search_20250305', model)
    }
  })

  it('is sent on the request for a search stage', async () => {
    const seen: { tools?: { type: string }[] }[] = []
    await call(fakeAnthropic(anthropicReply({}), seen), 'claude-haiku-4-5', true)
    assert.equal(seen[0].tools?.[0].type, 'web_search_20250305')
  })
})

describe('completeJSONLogged writes a cost row for a billed failure', () => {
  function harness(failWrite = false) {
    const rows: Record<string, unknown>[] = []
    const payload = {
      async create({ collection, data }: { collection: string; data: Record<string, unknown> }) {
        assert.equal(collection, 'cost-log')
        if (failWrite) throw new Error('db down')
        rows.push(data)
        return { id: rows.length }
      },
    } as unknown as Payload
    const ctx = (llm: CostContext['llm']): CostContext => ({
      payload,
      runId: 'run-1',
      mode: 'live',
      models: { generate: 'claude-opus-5' } as CostContext['models'],
      llm,
    })
    return { rows, ctx }
  }

  const failing = (error: unknown): CostContext['llm'] => ({
    completeJSON: async () => {
      throw error
    },
  })

  it('records the spend, then rethrows the same error', async () => {
    const { rows, ctx } = harness()
    const original = new LlmReplyError('[llm:generate] reply truncated at max_tokens', 'max_tokens', {
      provider: 'anthropic',
      model: 'claude-opus-5',
      usage: { inputTokens: 1_000_000, outputTokens: 0, webSearchRequests: 3 },
    })
    const error = await rejection(completeJSONLogged(ctx(failing(original)), 'generate', 5, { system: 's', user: 'u' }))
    assert.equal(error, original)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].inputTokens, 1_000_000)
    assert.equal(rows[0].webSearchRequests, 3)
    assert.equal(rows[0].provider, 'anthropic')
    assert.equal(rows[0].article, 5)
    // 1M input tokens at the catalog price plus three searches.
    assert.equal(rows[0].costUsd, 5 + 0.03)
    assert.deepEqual(rows[0].response, { error: original.message })
  })

  it('stops with CostLogWriteError when the row for a billed failure cannot be written', async () => {
    const { ctx } = harness(true)
    const original = new LlmReplyError('[llm:generate] no text', 'no_text', {
      provider: 'anthropic',
      model: 'claude-opus-5',
      usage: { inputTokens: 1, outputTokens: 1, webSearchRequests: 0 },
    })
    const error = await rejection(completeJSONLogged(ctx(failing(original)), 'generate', 5, { system: 's', user: 'u' }))
    assert.ok(error instanceof CostLogWriteError)
    assert.match(error.message, /db down.*the model call had also failed: \[llm:generate\] no text/)
  })

  it('writes no row when the provider never answered (transport or API error)', async () => {
    const { rows, ctx } = harness()
    const original = new Error('[llm:generate] rate limited by the Claude API')
    const error = await rejection(completeJSONLogged(ctx(failing(original)), 'generate', 5, { system: 's', user: 'u' }))
    assert.equal(error, original)
    assert.equal(rows.length, 0)
  })
})
