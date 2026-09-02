import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CODEX_LOGIN_HINT } from '../src/codexAuth'
import {
  CodexNotLoggedInError,
  type CodexTextRequest,
  type CodexTextResult,
} from '../src/codexCompletion'
import { mockFixture } from '../src/fixtures'
import { createLlmClient } from '../src/llm'

const JSON_ONLY = 'Reply with only a single JSON object. No prose, no code fences.'
const MODEL = 'codex/gpt-5.6-terra'

/** Stands in for the Codex adapter: records the request, answers or throws. */
function fakeCodex(outcome: Partial<CodexTextResult> | { throws: Error }) {
  const calls: CodexTextRequest[] = []
  const codex = async (request: CodexTextRequest): Promise<CodexTextResult> => {
    calls.push(request)
    if ('throws' in outcome) throw outcome.throws
    return {
      text: '{"ok":true}',
      usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      model: request.model,
      ...outcome,
    }
  }
  return { calls, codex }
}

describe('createLlmClient (codex routing)', () => {
  it('sends a codex/ model to the Codex adapter and reports the prefixed id', async () => {
    const { calls, codex } = fakeCodex({})
    const result = await createLlmClient('live', { codex }).completeJSON(
      'generate',
      { system: 'SYS', user: 'USR' },
      MODEL,
    )
    assert.equal(calls.length, 1)
    assert.equal(calls[0].model, MODEL)
    assert.deepEqual(result.json, { ok: true })
    assert.equal(result.provider, 'codex')
    // `costUsd` prices the catalog id, which is the prefixed one.
    assert.equal(result.model, MODEL)
  })

  it('appends the JSON instruction to the system turn exactly once', async () => {
    const { calls, codex } = fakeCodex({})
    await createLlmClient('live', { codex }).completeJSON(
      'generate',
      { system: 'SYS', user: 'USR' },
      MODEL,
    )
    assert.equal(calls[0].system, `SYS\n\n${JSON_ONLY}`)
    assert.equal(calls[0].user, 'USR')
    assert.equal(`${calls[0].system}${calls[0].user}`.split(JSON_ONLY).length - 1, 1)
  })

  it('parses a fenced reply', async () => {
    const { codex } = fakeCodex({ text: '```json\n{"ok":true}\n```' })
    const result = await createLlmClient('live', { codex }).completeJSON(
      'generate',
      { system: 'SYS', user: 'USR' },
      MODEL,
    )
    assert.deepEqual(result.json, { ok: true })
  })

  it('passes the usage through', async () => {
    const { codex } = fakeCodex({
      usage: { inputTokens: 15_767, outputTokens: 42, webSearchRequests: 2 },
    })
    const result = await createLlmClient('live', { codex }).completeJSON(
      'generate',
      { system: 'SYS', user: 'USR' },
      MODEL,
    )
    assert.deepEqual(result.usage, { inputTokens: 15_767, outputTokens: 42, webSearchRequests: 2 })
  })

  it('carries needWebSearch to the adapter', async () => {
    const { calls, codex } = fakeCodex({})
    const client = createLlmClient('live', { codex })
    await client.completeJSON('factCheck', { system: 'S', user: 'U', needWebSearch: true }, MODEL)
    await client.completeJSON('generate', { system: 'S', user: 'U' }, MODEL)
    assert.equal(calls[0].needWebSearch, true)
    assert.equal(calls[1].needWebSearch, undefined)
  })
})

describe('createLlmClient (codex failures)', () => {
  it('names the login as the cause when the CLI is logged out', async () => {
    const { codex } = fakeCodex({
      throws: new CodexNotLoggedInError(`Codex: 401 Unauthorized — ${CODEX_LOGIN_HINT}`),
    })
    await assert.rejects(
      createLlmClient('live', { codex }).completeJSON(
        'generate',
        { system: 'S', user: 'U' },
        MODEL,
      ),
      (error: Error) => {
        assert.equal(
          error.message,
          `[llm:generate] Codex is not logged in — ${CODEX_LOGIN_HINT}`,
        )
        return true
      },
    )
  })

  it('names the stage once when the reply is not JSON', async () => {
    const { codex } = fakeCodex({ text: 'sorry, no' })
    await assert.rejects(
      createLlmClient('live', { codex }).completeJSON(
        'generate',
        { system: 'S', user: 'U' },
        MODEL,
      ),
      (error: Error) => {
        assert.equal(error.message, '[llm:generate] model reply was not valid JSON: sorry, no')
        return true
      },
    )
  })

  it('prefixes any other failure once, keeping the adapter prefix intact', async () => {
    const { codex } = fakeCodex({ throws: new Error('Codex: Codex Exec exited with 1: boom') })
    await assert.rejects(
      createLlmClient('live', { codex }).completeJSON(
        'generate',
        { system: 'S', user: 'U' },
        MODEL,
      ),
      (error: Error) => {
        assert.equal(error.message, '[llm:generate] Codex: Codex Exec exited with 1: boom')
        return true
      },
    )
  })
})

describe('createLlmClient (mock mode with a codex/ model)', () => {
  it('never reaches the adapter and still honours fixtureKey', async () => {
    const { calls, codex } = fakeCodex({})
    const result = await createLlmClient('mock', { codex }).completeJSON(
      'claimExtraction',
      { system: 's', user: 'u', fixtureKey: 'page' },
      MODEL,
    )
    assert.equal(calls.length, 0)
    assert.equal(result.provider, 'mock')
    assert.deepEqual(result.json, mockFixture('claimExtraction', 'page'))
  })
})
