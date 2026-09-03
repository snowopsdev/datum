import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Payload } from 'payload'

import { type LlmSettingsDoc, PIPELINE_STAGES } from '../../cms/src/lib/llmSettings'
import { loadStageModels, type StageModelDeps } from '../src/models'

/** A Payload stand-in that answers the one global `loadStageModels` reads. */
const fakePayload = (settings: LlmSettingsDoc): Payload =>
  ({ findGlobal: async () => settings }) as unknown as Payload

/** Runs `body` with console output swallowed, so the suite stays readable. */
const quietly = async <T>(body: () => Promise<T>): Promise<T> => {
  const { log, warn } = console
  console.log = () => {}
  console.warn = () => {}
  try {
    return await body()
  } finally {
    console.log = log
    console.warn = warn
  }
}

function deps(overrides: Partial<StageModelDeps> = {}): StageModelDeps {
  return {
    env: { ANTHROPIC_API_KEY: 'test-key' },
    mockMode: false,
    ...overrides,
  }
}

describe('loadStageModels (codex stages)', () => {
  it('rejects a codex model before a live run starts', async () => {
    await assert.rejects(
      quietly(() =>
        loadStageModels(fakePayload({ generateModel: 'codex/gpt-5.6-sol' }), deps()),
      ),
      (error: Error) => {
        assert.equal(
          error.message,
          'generate model "codex/gpt-5.6-sol" (from admin) cannot run live because local Codex execution is disabled; select an API-backed model',
        )
        return true
      },
    )
  })

  it('preserves codex selections as harmless fixture labels in mock mode', async () => {
    const models = await quietly(() =>
      loadStageModels(
        fakePayload({ generateModel: 'codex/gpt-5.6-sol' }),
        deps({ env: {}, mockMode: true }),
      ),
    )
    assert.equal(models.generate, 'codex/gpt-5.6-sol')
  })
})

describe('loadStageModels (every stage)', () => {
  it('resolves a model for every stage, the newest included', async () => {
    const models = await quietly(() =>
      loadStageModels(fakePayload({ evidenceCheckModel: 'claude-haiku-4-5' }), deps()),
    )
    assert.deepEqual(Object.keys(models).sort(), [...PIPELINE_STAGES].sort())
    assert.equal(models.evidenceCheck, 'claude-haiku-4-5')
    // Unset stages still fall through to the platform default rather than
    // arriving undefined and being sent as the string "undefined".
    assert.equal(models.factCheck, 'claude-opus-5')
  })

  it('holds the evidence check to the same credential check as every other stage', async () => {
    await assert.rejects(
      quietly(() =>
        loadStageModels(fakePayload({ evidenceCheckModel: 'gpt-5.4-mini' }), deps()),
      ),
      (error: Error) => {
        assert.equal(
          error.message,
          'evidenceCheck model "gpt-5.4-mini" (from admin) needs OPENAI_API_KEY set (MOCK_MODE=false)',
        )
        return true
      },
    )
  })
})

describe('loadStageModels (api key stages)', () => {
  it('still names the missing env var exactly as before', async () => {
    await assert.rejects(
      quietly(() =>
        loadStageModels(fakePayload({ generateModel: 'gpt-5.6-sol' }), deps()),
      ),
      (error: Error) => {
        assert.equal(
          error.message,
          'generate model "gpt-5.6-sol" (from admin) needs OPENAI_API_KEY set (MOCK_MODE=false)',
        )
        return true
      },
    )
  })
})
