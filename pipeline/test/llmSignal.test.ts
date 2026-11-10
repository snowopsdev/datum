import assert from 'node:assert/strict'
import { it } from 'node:test'

import type { Payload } from 'payload'

import { type CostContext, completeJSONLogged, type LlmClient } from '../src/llm'

it('makes no model call, and so buys nothing, once the run signal is aborted', async () => {
  let calls = 0
  let costRows = 0
  const llm: LlmClient = {
    completeJSON: async () => {
      calls += 1
      throw new Error('must not be called')
    },
  }
  const controller = new AbortController()
  controller.abort(new Error('lease lost'))
  const ctx = {
    payload: { create: async () => (costRows += 1) } as unknown as Payload,
    runId: 'aborted',
    mode: 'mock',
    models: {},
    llm,
    signal: controller.signal,
  } as unknown as CostContext
  await assert.rejects(
    completeJSONLogged(ctx, 'generate', 1, { system: 's', user: 'u' }),
    /lease lost/,
  )
  assert.equal(calls, 0)
  assert.equal(costRows, 0)
})
