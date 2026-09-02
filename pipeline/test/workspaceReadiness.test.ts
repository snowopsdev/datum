import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  evaluateWorkspaceReadiness,
  type WorkspaceReadinessInput,
} from '../../cms/src/lib/workspaceReadiness'

const baseInput = (): WorkspaceReadinessInput => ({
  env: { MOCK_MODE: 'true' },
  models: {
    generateModel: null,
    factCheckModel: null,
    qualitativeReviewModel: null,
    claimExtractionModel: null,
    informationGainJudgeModel: null,
    evidenceVerificationModel: null,
  },
  activeVoice: { id: 7, updatedAt: '2026-08-25T12:00:00.000Z' },
  templates: [{ id: 3, name: 'How-To', updatedAt: '2026-08-25T12:00:00.000Z' }],
  verification: null,
})

describe('workspace readiness', () => {
  it('shows a governed mock workspace as ready, independent of verification', () => {
    const readiness = evaluateWorkspaceReadiness(baseInput())

    assert.equal(readiness.mode, 'mock')
    assert.equal(readiness.runtime.ready, true)
    assert.equal(readiness.governance.ready, true)
    assert.equal(readiness.content.ready, true)
    // `ready` is a run-time question — can Datum write and score content — not
    // an onboarding one, so it does not wait on a verification run nobody has
    // done yet.
    assert.equal(readiness.verification.ready, false)
    assert.equal(readiness.ready, true)
    assert.deepEqual(readiness.runtime.missing, [])
  })

  it('reports only variable names needed by the resolved live providers', () => {
    const input = baseInput()
    input.env = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor.example',
      OPENAI_API_KEY: 'configured',
    }
    input.models = {
      generateModel: 'gpt-5.6-terra',
      factCheckModel: 'claude-sonnet-5',
      qualitativeReviewModel: 'gpt-5.6-luna',
    }

    const readiness = evaluateWorkspaceReadiness(input)

    assert.equal(readiness.mode, 'live')
    assert.equal(readiness.runtime.ready, false)
    assert.deepEqual(readiness.runtime.missing, ['ANTHROPIC_API_KEY'])
    assert.deepEqual(
      readiness.content.models.map((model) => [
        model.stage,
        model.model,
        model.provider,
        model.configured,
      ]),
      [
        ['generate', 'gpt-5.6-terra', 'openai', true],
        ['factCheck', 'claude-sonnet-5', 'anthropic', false],
        ['qualitativeReview', 'gpt-5.6-luna', 'openai', true],
        // The information-gain slots are unset here, so they fall back to the
        // platform default (Claude) and report the missing Anthropic key too.
        ['claimExtraction', 'claude-opus-5', 'anthropic', false],
        ['informationGainJudge', 'claude-opus-5', 'anthropic', false],
        ['evidenceVerification', 'claude-opus-5', 'anthropic', false],
      ],
    )
  })

  it('holds a Codex stage back on the CLI login rather than an environment variable', () => {
    const input = baseInput()
    input.env = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor.example',
      ANTHROPIC_API_KEY: 'configured',
    }
    input.models = { generateModel: 'codex/gpt-5.6-terra' }

    const loggedOut = evaluateWorkspaceReadiness(input)
    assert.equal(loggedOut.runtime.needsCodexLogin, true)
    assert.equal(loggedOut.runtime.ready, false)
    // Everything else is configured, so `missing` is the proof that a login is
    // never reported as an environment variable somebody could set.
    assert.deepEqual(loggedOut.runtime.missing, [])
    assert.deepEqual(
      loggedOut.content.models.map((model) => [
        model.stage,
        model.model,
        model.provider,
        model.configured,
      ])[0],
      ['generate', 'codex/gpt-5.6-terra', 'codex', false],
    )
    assert.equal(loggedOut.content.models[0]!.envVar, null)
    assert.equal(loggedOut.content.models[0]!.requirement, 'codex-login')

    input.codexLoggedIn = true
    const loggedIn = evaluateWorkspaceReadiness(input)
    assert.equal(loggedIn.content.models[0]!.configured, true)
    assert.equal(loggedIn.runtime.needsCodexLogin, false)
    assert.equal(loggedIn.runtime.ready, true)
    // A login the fingerprint ignored would leave a run verified against the
    // logged-out configuration looking current.
    assert.notEqual(loggedIn.configFingerprint, loggedOut.configFingerprint)
  })

  it('treats a Codex stage as configured in mock mode, logged in or not', () => {
    const input = baseInput()
    input.models = { generateModel: 'codex/gpt-5.6-terra' }

    const readiness = evaluateWorkspaceReadiness(input)
    assert.equal(readiness.content.models[0]!.configured, true)
    assert.equal(readiness.runtime.needsCodexLogin, false)
    assert.equal(readiness.runtime.ready, true)
  })

  it('fingerprints a workspace with no Codex stage exactly as it did before Codex', () => {
    // Frozen inputs and hashes: the fingerprint decides whether a verification
    // run is still current, so a change here stales every existing run. Only
    // recompute these when that is the intent.
    const mock: WorkspaceReadinessInput = {
      env: { MOCK_MODE: 'true' },
      models: null,
      activeVoice: { id: 7, updatedAt: '2026-08-25T12:00:00.000Z' },
      templates: [{ id: 3, name: 'How-To', updatedAt: '2026-08-25T12:00:00.000Z' }],
      verification: null,
    }
    assert.equal(
      evaluateWorkspaceReadiness(mock).configFingerprint,
      '9e86d22e580de7037a542c879d963f057056e728d77048ca170cd9ccaf935341',
    )

    const live: WorkspaceReadinessInput = {
      ...mock,
      env: {
        MOCK_MODE: 'false',
        AHREFS_API_KEY: 'configured',
        TARGET_DOMAIN: 'example.com',
        COMPETITOR_DOMAINS: 'competitor.example',
        OPENAI_API_KEY: 'configured',
      },
      models: {
        generateModel: 'gpt-5.6-terra',
        factCheckModel: 'claude-sonnet-5',
        qualitativeReviewModel: 'gpt-5.6-luna',
      },
    }
    assert.equal(
      evaluateWorkspaceReadiness(live).configFingerprint,
      '4f44a0ba913c6390dcbe423c9d3ff668df4e1f71a0d232ab3a3b7c326d415907',
    )
  })

  it('accepts a terminal QA result only when its configuration fingerprint is current', () => {
    const input = baseInput()
    const current = evaluateWorkspaceReadiness(input)
    input.verification = {
      runId: 'onboarding:1',
      status: 'succeeded',
      articleStatus: 'needs_revision',
      configFingerprint: current.configFingerprint,
      completedAt: '2026-08-25T12:05:00.000Z',
    }

    const verified = evaluateWorkspaceReadiness(input)
    assert.equal(verified.verification.ready, true)
    assert.equal(verified.ready, true)

    input.activeVoice = {
      ...input.activeVoice!,
      updatedAt: '2026-08-25T12:10:00.000Z',
    }
    const stale = evaluateWorkspaceReadiness(input)
    assert.equal(stale.verification.ready, false)
    assert.equal(stale.verification.stale, true)
    // A config change stales the verification snapshot, but governance and
    // templates are unaffected, so the workspace is still ready to run.
    assert.equal(stale.ready, true)
  })
})

describe('codex login is reported to blocked actions', () => {
  it('lists the login among blockers so action errors are never empty', () => {
    const input = baseInput()
    input.env = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor.example',
      ANTHROPIC_API_KEY: 'configured',
    }
    input.models = { generateModel: 'codex/gpt-5.6-terra' }
    input.codexLoggedIn = false

    const readiness = evaluateWorkspaceReadiness(input)

    assert.deepEqual(readiness.runtime.missing, [])
    assert.equal(readiness.runtime.needsCodexLogin, true)
    // The action messages interpolate this list; an empty one renders
    // "Configure the required environment variables: ." and helps nobody.
    assert.ok(readiness.runtime.blockers.length > 0)
    assert.match(readiness.runtime.blockers.join(' '), /codex login/)
  })

  it('leaves blockers equal to missing when no codex stage is selected', () => {
    const input = baseInput()
    input.env = { MOCK_MODE: 'false', OPENAI_API_KEY: 'configured' }
    input.models = { generateModel: 'gpt-5.6-terra' }
    const readiness = evaluateWorkspaceReadiness(input)
    assert.deepEqual(readiness.runtime.blockers, readiness.runtime.missing)
  })
})
