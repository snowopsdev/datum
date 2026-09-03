import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Payload } from 'payload'

import { type LlmSettingsDoc, PIPELINE_STAGES } from '../../cms/src/lib/llmSettings'
import { CODEX_LOGIN_HINT } from '../src/codexAuth'
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

type CountingDeps = StageModelDeps & { logins: number }

function deps(overrides: Partial<StageModelDeps> = {}): CountingDeps {
  const state: CountingDeps = {
    env: { ANTHROPIC_API_KEY: 'test-key' },
    mockMode: false,
    logins: 0,
    checkLogin: async () => {
      state.logins += 1
      return true
    },
    ...overrides,
  }
  return state
}

describe('loadStageModels (codex stages)', () => {
  it('accepts a codex model when the CLI is logged in', async () => {
    const injected = deps()
    const models = await quietly(() =>
      loadStageModels(fakePayload({ generateModel: 'codex/gpt-5.6-sol' }), injected),
    )
    assert.equal(models.generate, 'codex/gpt-5.6-sol')
    assert.equal(injected.logins, 1)
  })

  it('rejects a codex model when the CLI is logged out', async () => {
    await assert.rejects(
      quietly(() =>
        loadStageModels(fakePayload({ generateModel: 'codex/gpt-5.6-sol' }), deps({
          checkLogin: async () => false,
        })),
      ),
      (error: Error) => {
        assert.equal(
          error.message,
          `generate model "codex/gpt-5.6-sol" (from admin) needs a Codex login — ${CODEX_LOGIN_HINT} (MOCK_MODE=false)`,
        )
        return true
      },
    )
  })

  it('checks the login once however many stages are on Codex', async () => {
    const injected = deps()
    await quietly(() =>
      loadStageModels(
        fakePayload({
          generateModel: 'codex/gpt-5.6-sol',
          factCheckModel: 'codex/gpt-5.6-terra',
          qualitativeReviewModel: 'codex/gpt-5.5',
          claimExtractionModel: 'codex/gpt-5.4',
        }),
        injected,
      ),
    )
    assert.equal(injected.logins, 1)
  })

  it('never checks the login in mock mode', async () => {
    const injected = deps({ env: {}, mockMode: true })
    await quietly(() =>
      loadStageModels(fakePayload({ generateModel: 'codex/gpt-5.6-sol' }), injected),
    )
    assert.equal(injected.logins, 0)
  })

  it('never checks the login when no stage is on Codex', async () => {
    const injected = deps()
    await quietly(() => loadStageModels(fakePayload({ generateModel: 'claude-sonnet-5' }), injected))
    assert.equal(injected.logins, 0)
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
