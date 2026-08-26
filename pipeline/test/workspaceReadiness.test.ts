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
  it('shows a governed mock workspace as ready except for verification', () => {
    const readiness = evaluateWorkspaceReadiness(baseInput())

    assert.equal(readiness.mode, 'mock')
    assert.equal(readiness.runtime.ready, true)
    assert.equal(readiness.governance.ready, true)
    assert.equal(readiness.content.ready, true)
    assert.equal(readiness.verification.ready, false)
    assert.equal(readiness.ready, false)
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
    assert.equal(stale.ready, false)
  })
})
