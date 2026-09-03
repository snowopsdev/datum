import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EVIDENCE_BANK_FIXTURE, POSITIONING_FIXTURE } from '../../cms/src/lib/tenant/fixtures'
import { emptyPositioningContent, resolveWorkspaceProfile } from '../../cms/src/lib/tenant'
import {
  evaluateWorkspaceReadiness,
  modeFromEnv,
  type WorkspaceReadinessInput,
} from '../../cms/src/lib/workspaceReadiness'

/** What `loadWorkspaceSetup` would resolve for this env with no global saved. */
const envProfile = (env: Record<string, string | undefined>) =>
  resolveWorkspaceProfile(null, env, { mockDefault: modeFromEnv(env) === 'mock' })

const baseInput = (): WorkspaceReadinessInput => ({
  env: { MOCK_MODE: 'true' },
  profile: envProfile({ MOCK_MODE: 'true' }),
  models: {
    generateModel: null,
    factCheckModel: null,
    qualitativeReviewModel: null,
    claimExtractionModel: null,
    informationGainJudgeModel: null,
    evidenceVerificationModel: null,
  },
  positioning: { content: null, updatedAt: null },
  // Pinned rather than left to default to today, so the expired-claim counts
  // below mean the same thing next year as they do this week.
  evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-02' },
  activeVoice: { id: 7, updatedAt: '2026-08-25T12:00:00.000Z' },
  templates: [{ id: 3, name: 'How-To', updatedAt: '2026-08-25T12:00:00.000Z' }],
  icps: [
    { id: 11, updatedAt: '2026-08-25T12:00:00.000Z', name: 'Marketing lead', primary: true },
  ],
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
    input.profile = envProfile(input.env)
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
        ['evidenceCheck', 'claude-opus-5', 'anthropic', false],
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
    input.profile = envProfile(input.env)
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
    // recompute these when that is the intent. They last moved when the
    // fingerprint started covering the evidence-bank global's timestamp, which
    // decides what a draft may state about the workspace. (Before that they
    // moved for the positioning global and the `evidenceCheck` stage joining
    // the model list, before that for the active audiences, and before that for
    // the resolved target domain and competitor list rather than "is
    // TARGET_DOMAIN set".)
    const mock: WorkspaceReadinessInput = {
      env: { MOCK_MODE: 'true' },
      profile: envProfile({ MOCK_MODE: 'true' }),
      models: null,
      activeVoice: { id: 7, updatedAt: '2026-08-25T12:00:00.000Z' },
      templates: [{ id: 3, name: 'How-To', updatedAt: '2026-08-25T12:00:00.000Z' }],
      icps: [
        { id: 11, updatedAt: '2026-08-25T12:00:00.000Z', name: 'Marketing lead', primary: true },
      ],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-02' },
      verification: null,
    }
    assert.equal(
      evaluateWorkspaceReadiness(mock).configFingerprint,
      '3bd47d95f8920c712b4193204260a6dfdfe6b488eaea9475491ac3158a12a0a2',
    )

    const liveEnv = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      TARGET_DOMAIN: 'example.com',
      COMPETITOR_DOMAINS: 'competitor.example',
      OPENAI_API_KEY: 'configured',
    }
    const live: WorkspaceReadinessInput = {
      ...mock,
      env: liveEnv,
      profile: envProfile(liveEnv),
      models: {
        generateModel: 'gpt-5.6-terra',
        factCheckModel: 'claude-sonnet-5',
        qualitativeReviewModel: 'gpt-5.6-luna',
      },
    }
    assert.equal(
      evaluateWorkspaceReadiness(live).configFingerprint,
      'f3a8cc08bde7aee291080b2c12d6aa7daed06cc2222fa9e9b35e4b85e7d8a37d',
    )
  })

  it('stops naming TARGET_DOMAIN once the Workspace global supplies one', () => {
    const input = baseInput()
    input.env = {
      MOCK_MODE: 'false',
      AHREFS_API_KEY: 'configured',
      OPENAI_API_KEY: 'configured',
      ANTHROPIC_API_KEY: 'configured',
    }
    input.profile = envProfile(input.env)
    // Nothing in the environment, so both variables are still the fix to make.
    const envOnly = evaluateWorkspaceReadiness(input)
    assert.deepEqual(envOnly.runtime.missing, ['COMPETITOR_DOMAINS', 'TARGET_DOMAIN'])
    assert.equal(envOnly.tenant.profile.ready, false)
    assert.equal(envOnly.tenant.profile.targetDomain, null)

    input.profile = resolveWorkspaceProfile(
      {
        targetDomain: 'acme.example',
        competitors: [{ domain: 'rivalone.com', name: 'Rival One' }],
      },
      input.env,
    )
    const withGlobal = evaluateWorkspaceReadiness(input)

    // The global answers both, so the banner has nothing left to ask for.
    assert.deepEqual(withGlobal.runtime.missing, [])
    assert.equal(withGlobal.runtime.ready, true)
    assert.equal(withGlobal.tenant.profile.ready, true)
    assert.equal(withGlobal.tenant.profile.targetDomain, 'acme.example')
    assert.equal(withGlobal.tenant.profile.competitorCount, 1)
    assert.deepEqual(withGlobal.tenant.profile.source, {
      targetDomain: 'admin',
      competitors: 'admin',
    })
    // Governance is untouched by the profile in this slice.
    assert.equal(withGlobal.governance.ready, true)
  })

  it('stales a verification run when the target domain itself changes', () => {
    const input = baseInput()
    input.profile = resolveWorkspaceProfile({ targetDomain: 'acme.example' }, {})
    const before = evaluateWorkspaceReadiness(input)

    input.profile = resolveWorkspaceProfile({ targetDomain: 'other.example' }, {})
    const afterDomain = evaluateWorkspaceReadiness(input)
    assert.notEqual(afterDomain.configFingerprint, before.configFingerprint)

    input.profile = resolveWorkspaceProfile(
      { targetDomain: 'acme.example', competitors: [{ domain: 'rivalone.com' }] },
      {},
    )
    const afterCompetitor = evaluateWorkspaceReadiness(input)
    assert.notEqual(afterCompetitor.configFingerprint, before.configFingerprint)
  })

  /**
   * Governance is three assets now, not one. Slice 2 gates content runs on a
   * target domain and an active audience as well as a brand voice, so every
   * existing workspace is blocked until it has all three — which is exactly
   * why the blockers have to be listed in words an operator can act on.
   */
  it('needs a voice, a target domain, and an active audience before it will run', () => {
    const input = baseInput()
    assert.equal(evaluateWorkspaceReadiness(input).governance.ready, true)
    assert.deepEqual(evaluateWorkspaceReadiness(input).governance.problems, [])

    const noIcp = evaluateWorkspaceReadiness({ ...input, icps: [] })
    assert.equal(noIcp.governance.ready, false)
    assert.equal(noIcp.tenant.icps.ready, false)
    assert.equal(noIcp.tenant.icps.count, 0)
    assert.equal(noIcp.tenant.icps.primaryId, null)
    assert.deepEqual(noIcp.governance.problems, ['Add and activate at least one audience (ICP)'])

    // Live mode with nothing anywhere: no mock default domain to lean on.
    const bare = evaluateWorkspaceReadiness({
      ...input,
      env: { MOCK_MODE: 'false' },
      profile: envProfile({ MOCK_MODE: 'false' }),
      activeVoice: null,
      icps: [],
    })
    assert.deepEqual(bare.governance.problems, [
      'Activate a brand voice',
      'Set the target domain',
      'Add and activate at least one audience (ICP)',
    ])
    // Templates are seeded and unaffected, so `ready` fails on governance alone.
    assert.equal(bare.content.ready, true)
    assert.equal(bare.ready, false)
  })

  it('reports the primary audience, falling back to the first when none is flagged', () => {
    const input = baseInput()
    input.icps = [
      { id: 11, updatedAt: 'a', name: 'Second', primary: false },
      { id: 22, updatedAt: 'b', name: 'Primary', primary: true },
    ]
    assert.equal(evaluateWorkspaceReadiness(input).tenant.icps.primaryId, 22)
    assert.equal(evaluateWorkspaceReadiness(input).tenant.icps.count, 2)

    input.icps = [{ id: 11, updatedAt: 'a', name: 'Only', primary: false }]
    assert.equal(evaluateWorkspaceReadiness(input).tenant.icps.primaryId, 11)
  })

  it('stales a verification run when an audience is edited, added, or archived', () => {
    const input = baseInput()
    const before = evaluateWorkspaceReadiness(input).configFingerprint

    input.icps = [{ ...input.icps[0]!, updatedAt: '2026-09-01T00:00:00.000Z' }]
    assert.notEqual(evaluateWorkspaceReadiness(input).configFingerprint, before)

    input.icps = [
      { id: 11, updatedAt: '2026-08-25T12:00:00.000Z', name: 'Marketing lead', primary: true },
      { id: 12, updatedAt: '2026-08-25T12:00:00.000Z', name: 'Founder', primary: false },
    ]
    assert.notEqual(evaluateWorkspaceReadiness(input).configFingerprint, before)

    input.icps = []
    assert.notEqual(evaluateWorkspaceReadiness(input).configFingerprint, before)
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
    input.profile = envProfile(input.env)
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
    input.profile = envProfile(input.env)
    input.models = { generateModel: 'gpt-5.6-terra' }
    const readiness = evaluateWorkspaceReadiness(input)
    assert.deepEqual(readiness.runtime.blockers, readiness.runtime.missing)
  })
})

/**
 * Positioning is recommended, never required.
 *
 * The distinction is the whole point of the asset: a workspace with no position
 * still writes, it just writes less like itself. If `governance.problems` ever
 * grew a positioning entry, every existing deployment would be blocked by a
 * form nobody asked them to fill in.
 */
describe('positioning readiness', () => {
  const partial = { ...emptyPositioningContent(), category: 'analytics for support teams' }

  it('never blocks a run, whatever state it is in', () => {
    for (const content of [null, partial, POSITIONING_FIXTURE]) {
      const readiness = evaluateWorkspaceReadiness({
        ...baseInput(),
        positioning: { content, updatedAt: content ? '2026-09-01T00:00:00.000Z' : null },
      })
      assert.equal(readiness.governance.ready, true)
      assert.deepEqual(readiness.governance.problems, [])
      assert.equal(readiness.ready, true)
    }
  })

  it('asks for a position when there is none, and for the rest when there is some', () => {
    const missing = evaluateWorkspaceReadiness(baseInput())
    assert.equal(missing.tenant.positioning.status, 'missing')
    assert.deepEqual(missing.tenant.positioning.problems, [])
    assert.deepEqual(missing.tenant.recommendations, ['Add positioning', 'Add an evidence bank'])

    const started = evaluateWorkspaceReadiness({
      ...baseInput(),
      positioning: { content: partial, updatedAt: '2026-09-01T00:00:00.000Z' },
    })
    assert.equal(started.tenant.positioning.status, 'partial')
    assert.deepEqual(started.tenant.positioning.problems, [
      'State the one goal',
      'Write the customer promise',
      'Name the position to own',
      'Write the positioning statement',
      'Write exactly three core claims (there are 0)',
      'Add at least one pillar',
    ])
    assert.deepEqual(started.tenant.recommendations, [
      'Finish positioning: State the one goal; Write the customer promise; Name the position to own; ' +
        'Write the positioning statement; Write exactly three core claims (there are 0); ' +
        'Add at least one pillar',
      'Add an evidence bank',
    ])

    const done = evaluateWorkspaceReadiness({
      ...baseInput(),
      positioning: { content: POSITIONING_FIXTURE, updatedAt: '2026-09-01T00:00:00.000Z' },
    })
    assert.equal(done.tenant.positioning.status, 'ready')
    assert.deepEqual(done.tenant.positioning.problems, [])
    assert.deepEqual(done.tenant.recommendations, ['Add an evidence bank'])
  })

  it('stales a verification run when the position is saved or edited', () => {
    const before = evaluateWorkspaceReadiness(baseInput()).configFingerprint
    const saved = evaluateWorkspaceReadiness({
      ...baseInput(),
      positioning: { content: partial, updatedAt: '2026-09-01T00:00:00.000Z' },
    }).configFingerprint
    assert.notEqual(saved, before)
    assert.notEqual(
      saved,
      evaluateWorkspaceReadiness({
        ...baseInput(),
        positioning: { content: partial, updatedAt: '2026-09-02T00:00:00.000Z' },
      }).configFingerprint,
    )
  })
})

/**
 * The bank is recommended, never required.
 *
 * A workspace with no bank writes perfectly good articles; it just may not
 * state anything about itself in them. Blocking a run on it would make the bank
 * a precondition for writing rather than a guarantee about what is written.
 */
describe('evidence bank readiness', () => {
  const stale = {
    ...EVIDENCE_BANK_FIXTURE,
    verifiedClaims: EVIDENCE_BANK_FIXTURE.verifiedClaims.map((claim) => ({
      ...claim,
      recheckAt: '2026-01-01',
    })),
  }

  it('never blocks a run, whatever state it is in', () => {
    for (const content of [null, EVIDENCE_BANK_FIXTURE, stale]) {
      const readiness = evaluateWorkspaceReadiness({
        ...baseInput(),
        evidenceBank: { content, updatedAt: content ? '2026-09-01T00:00:00.000Z' : null, asOf: '2026-09-02' },
      })
      assert.equal(readiness.governance.ready, true)
      assert.deepEqual(readiness.governance.problems, [])
      assert.equal(readiness.ready, true)
    }
  })

  it('is ready on one usable claim or one plain fact, and reports the counts', () => {
    const missing = evaluateWorkspaceReadiness(baseInput())
    assert.deepEqual(missing.tenant.evidenceBank, {
      status: 'missing',
      verified: 0,
      usable: 0,
      expired: 0,
      incomplete: 0,
      facts: 0,
      rejected: 0,
    })

    const filled = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: { content: EVIDENCE_BANK_FIXTURE, updatedAt: '2026-09-01T00:00:00.000Z', asOf: '2026-09-02' },
    })
    assert.deepEqual(filled.tenant.evidenceBank, {
      status: 'ready',
      verified: 3,
      usable: 3,
      expired: 0,
      incomplete: 0,
      facts: 2,
      rejected: 1,
    })
    assert.deepEqual(filled.tenant.recommendations, ['Add positioning'])

    // Facts alone are enough: a workspace that has only written down its
    // founding year can still say that much.
    const factsOnly = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: {
        content: { verifiedClaims: [], facts: EVIDENCE_BANK_FIXTURE.facts, rejectedClaims: [] },
        updatedAt: '2026-09-01T00:00:00.000Z',
        asOf: '2026-09-02',
      },
    })
    assert.equal(factsOnly.tenant.evidenceBank.status, 'ready')
  })

  it('will not call a bank of unfinished rows ready, and says what they need', () => {
    // Every claim without a source: the shape the setup assistant leaves behind
    // when nobody goes back to finish it. The counts have to show that nothing
    // in here is citable, or the hub reports three claims and the writer is
    // given none.
    const unfinished = {
      verifiedClaims: EVIDENCE_BANK_FIXTURE.verifiedClaims.map((claim) => ({
        ...claim,
        primarySource: '',
        verificationDepth: 'self_reported' as const,
      })),
      facts: [],
      rejectedClaims: [],
    }
    const readiness = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: { content: unfinished, updatedAt: '2026-09-01T00:00:00.000Z', asOf: '2026-09-02' },
    })
    assert.equal(readiness.tenant.evidenceBank.status, 'missing')
    assert.equal(readiness.tenant.evidenceBank.verified, 3)
    assert.equal(readiness.tenant.evidenceBank.usable, 0)
    assert.equal(readiness.tenant.evidenceBank.incomplete, 3)
    assert.deepEqual(readiness.tenant.recommendations, [
      'Add positioning',
      'Add an evidence bank',
      'Complete 3 unverified claims',
    ])
    // Still never a blocker, whatever state the rows are in.
    assert.equal(readiness.governance.ready, true)

    const one = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: {
        content: { ...unfinished, verifiedClaims: unfinished.verifiedClaims.slice(0, 1) },
        updatedAt: '2026-09-01T00:00:00.000Z',
        asOf: '2026-09-02',
      },
    })
    assert.ok(one.tenant.recommendations.includes('Complete 1 unverified claim'))
  })

  it('asks for a re-check separately from asking for a bank', () => {
    const expired = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: { content: stale, updatedAt: '2026-09-01T00:00:00.000Z', asOf: '2026-09-02' },
    })
    assert.equal(expired.tenant.evidenceBank.expired, 3)
    assert.equal(expired.tenant.evidenceBank.usable, 0)
    // Facts keep it `ready`: there is still something a draft could cite. The
    // expired claims are a separate, smaller job than writing a bank from
    // scratch, and the wording says which one this workspace needs.
    assert.equal(expired.tenant.evidenceBank.status, 'ready')
    assert.deepEqual(expired.tenant.recommendations, [
      'Add positioning',
      'Re-check 3 expired claims',
    ])

    const one = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: {
        content: { ...stale, verifiedClaims: stale.verifiedClaims.slice(0, 1) },
        updatedAt: '2026-09-01T00:00:00.000Z',
        asOf: '2026-09-02',
      },
    })
    assert.ok(one.tenant.recommendations.includes('Re-check 1 expired claim'))
  })

  it('stales a verification run when the bank is saved or edited', () => {
    const before = evaluateWorkspaceReadiness(baseInput()).configFingerprint
    const saved = evaluateWorkspaceReadiness({
      ...baseInput(),
      evidenceBank: { content: EVIDENCE_BANK_FIXTURE, updatedAt: '2026-09-01T00:00:00.000Z', asOf: '2026-09-02' },
    }).configFingerprint
    assert.notEqual(saved, before)
    assert.notEqual(
      saved,
      evaluateWorkspaceReadiness({
        ...baseInput(),
        evidenceBank: { content: EVIDENCE_BANK_FIXTURE, updatedAt: '2026-09-02T00:00:00.000Z', asOf: '2026-09-02' },
      }).configFingerprint,
    )
  })
})
