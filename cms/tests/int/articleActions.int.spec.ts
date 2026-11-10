import { beforeEach, describe, expect, it, vi } from 'vitest'

import { APIError } from 'payload'

import { gateReviewOverride, gateVerifiedStatus } from '@/lib/articleReviewGate'
import { buildRegenerateRevisionNotes } from '@/components/ops/articleStatus'

// Mocked so resetToDraftedAction/sendBackAction/regenerateArticleAction can run outside a
// real Next.js request scope and a real Payload instance below. `payload` itself keeps its
// real exports (importOriginal) — gateReviewOverride/gateVerifiedStatus above import
// `APIError` from it, and a bare replacement would break those.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'reviewer@example.com' } }))
const findByIDMock = vi.fn(
  async () =>
    ({
      id: 1,
      status: 'needs_revision',
      qaResults: undefined,
      revisionCount: 0,
      template: 3,
    }) as never,
)
const findMock = vi.fn(
  async (_args: { collection?: string; where?: unknown }) => ({ docs: [] }) as never,
)
// `activeRunIncludesArticle` (lib/activeRuns.ts) asks with `count`, not `find`:
// the archive refusal runs through the real helper so the predicate it pushes
// into the query is the one under test, not a second copy written here.
const countMock = vi.fn(
  async (_args: { collection?: string; where?: unknown }) => ({ totalDocs: 0 }) as never,
)
// Echoes back what was written, the way the real `payload.update` returns the
// updated document — the queue step reads the article's *new* status from it.
const updateMock = vi.fn(
  async (args: { id?: number; data?: Record<string, unknown> }) =>
    ({ id: args?.id ?? 1, template: 3, ...args?.data }) as never,
)

// The workspace checklist and the run creator are the two things the queue step
// added to these actions. Both are mocked: the checklist reads eight collections
// and globals, and `createPipelineRun` opens a Postgres transaction and takes an
// advisory lock. `ActivePipelineRunError` is kept real (importOriginal) because
// `actions.ts` branches on `instanceof`.
const { createPipelineRunMock, loadWorkspaceSetupMock, revalidatePathMock } = vi.hoisted(() => ({
  createPipelineRunMock: vi.fn(),
  loadWorkspaceSetupMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }))
vi.mock('@/lib/loadWorkspaceReadiness', () => ({
  loadWorkspaceSetup: loadWorkspaceSetupMock,
  loadActiveAudienceOptions: vi.fn(async () => []),
}))
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createPipelineRunMock }
})
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({
      auth: authMock,
      findByID: findByIDMock,
      find: findMock,
      count: countMock,
      update: updateMock,
    })),
  }
})

/** Enough of `WorkspaceSetupData` for the queue decision; nothing else reads it. */
const readySetup = (overrides: Record<string, unknown> = {}) =>
  ({
    readiness: {
      mode: 'mock',
      runtime: { ready: true, missing: [], blockers: [] },
      governance: { ready: true, activeVoiceId: 1, problems: [] },
      ...overrides,
    },
    templates: [{ id: 3, name: 'Guide' }],
    icps: [],
    latestRun: null,
  }) as never

loadWorkspaceSetupMock.mockResolvedValue(readySetup())
createPipelineRunMock.mockResolvedValue(undefined)

const { ActivePipelineRunError } = await import('@/lib/createPipelineRun')
const {
  approveArticleAction,
  archiveArticleAction,
  overrideReviewAction,
  publishArticleAction,
  regenerateArticleAction,
  resetToDraftedAction,
  scheduleArticleAction,
  sendBackAction,
  unarchiveArticleAction,
  unscheduleArticleAction,
} = await import('@/components/ops/actions')

describe('buildRegenerateRevisionNotes', () => {
  const article = { qaResults: { structural: { passed: true, violations: [] } } }

  it('builds a bullet per reason from the latest run', () => {
    const notes = buildRegenerateRevisionNotes(
      {
        reasons: [
          { policy: 'noveltyFloor', message: 'no materially novel claims', severity: 'REVISE' },
          { policy: 'evidenceIntegrity', message: 'two claims unverified', severity: 'REVISE' },
        ],
      },
      article,
    )
    expect(notes).toBe(
      '- [noveltyFloor] no materially novel claims\n- [evidenceIntegrity] two claims unverified',
    )
  })

  it('falls back to QA failures when there is no run', () => {
    const notes = buildRegenerateRevisionNotes(null, {
      qaResults: { factCheck: { passed: false, notes: 'unsupported stat' } },
    } as never)
    expect(notes).toBe(
      '- [Fact check] unsupported stat Correct each of these, and keep every other fact as it stands. Cite a source for anything you change.',
    )
  })

  it('falls back to QA failures when the run has no reasons', () => {
    const notes = buildRegenerateRevisionNotes({ reasons: [] }, {
      qaResults: { qualitativeReview: { passed: false, notes: 'too salesy' } },
    } as never)
    expect(notes).toBe(
      '- [Style] too salesy Rewrite to address this, keeping everything the review did not object to.',
    )
  })

  it('appends the reviewer note after the reasons', () => {
    const notes = buildRegenerateRevisionNotes(
      { reasons: [{ policy: 'noveltyFloor', message: 'thin', severity: 'REVISE' }] },
      article,
      '  please add a comparison table  ',
    )
    expect(notes).toBe('- [noveltyFloor] thin\n\nReviewer note: please add a comparison table')
  })

  it('is just the reviewer note when there are no reasons and no QA failures', () => {
    const notes = buildRegenerateRevisionNotes(null, article, 'tighten the intro')
    expect(notes).toBe('Reviewer note: tighten the intro')
  })

  it('ignores a whitespace-only reviewer note', () => {
    const notes = buildRegenerateRevisionNotes(
      { reasons: [{ policy: 'noveltyFloor', message: 'thin', severity: 'REVISE' }] },
      article,
      '   ',
    )
    expect(notes).toBe('- [noveltyFloor] thin')
  })
})

// The write shape overrideReviewAction sends — { status: 'verified', reviewJustification,
// reviewedBy } — run straight through the two hooks it depends on, gateReviewOverride then
// gateVerifiedStatus (see Articles.ts). This exercises the hooks, not the action: the action
// itself is covered by 'overrideReviewAction only overrides…' and the gate refusal test below.
describe('the two review gates, given the write shape overrideReviewAction sends', () => {
  const runGates = (data: Record<string, unknown>, originalDoc: Record<string, unknown>) => {
    const context: Record<string, unknown> = {}
    const afterFirst = gateReviewOverride({
      data,
      originalDoc,
      req: { user: { id: 7, email: 'reviewer@example.com' } },
      context,
    } as never) as Record<string, unknown>
    const afterSecond = gateVerifiedStatus({
      data: afterFirst,
      originalDoc,
      req: { user: { id: 7, email: 'reviewer@example.com' } },
      context,
    } as never) as Record<string, unknown>
    return { result: afterSecond, context }
  }

  it('passes both gates from needs_review with a fresh justification', () => {
    const { result, context } = runGates(
      { status: 'verified', reviewJustification: 'checked the sources by hand' },
      { status: 'needs_review', reviewJustification: 'an older, stale reason' },
    )
    expect(result.status).toBe('verified')
    expect(result.reviewJustification).toBe('checked the sources by hand')
    expect(result.reviewedBy).toBe('reviewer@example.com')
    expect(context.articleAudit).toEqual({
      event: 'review_overridden',
      summary: 'Reviewer overrode needs_review',
      details: { justification: 'checked the sources by hand', targetStatus: 'verified' },
    })
  })

  it('passes both gates from blocked with a fresh justification, auditing block_overridden', () => {
    const { context } = runGates(
      { status: 'verified', reviewJustification: 'escalated and cleared' },
      { status: 'blocked', reviewJustification: 'the reason it was blocked' },
    )
    expect(context.articleAudit).toEqual({
      event: 'block_overridden',
      summary: 'Reviewer overrode blocked',
      details: { justification: 'escalated and cleared', targetStatus: 'verified' },
    })
  })

  it('is rejected by gateReviewOverride when the justification reuses the persisted one', () => {
    // A stale justification riding along on a full-document save must not
    // silently satisfy either gate.
    expect(() =>
      runGates(
        { status: 'verified', reviewJustification: 'same reason as last time' },
        { status: 'needs_review', reviewJustification: 'same reason as last time' },
      ),
    ).toThrow('new reviewJustification')
  })

  it('is rejected by gateReviewOverride when no justification is submitted at all', () => {
    expect(() =>
      runGates({ status: 'verified' }, { status: 'blocked', reviewJustification: null }),
    ).toThrow('reviewJustification')
  })
})

// resetToDraftedAction, sendBackAction, and regenerateArticleAction all send an article
// back to be reworked, and all three must clear informationGain the same way — a decision
// that lingers on any one of them would show a scored verdict beside a draft nobody has
// re-scored yet. Locks the exact all-null shape and overrideAccess so the three can't
// silently drift apart (e.g. one of them missing a key, or losing overrideAccess and
// silently no-op'ing the clear because the field is access-guarded).
describe('the three send-back-for-rework actions null informationGain identically', () => {
  const EXPECTED_NULL_INFORMATION_GAIN = {
    run: null,
    decision: null,
    policyVersion: null,
    consensusCoverage: null,
    verifiedGainUnits: null,
    verificationRatio: null,
    internalDuplicationRate: null,
    verifiedNovelClaims: null,
    scoredAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_revision',
      qaResults: undefined,
      revisionCount: 0,
    } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  it('resetToDraftedAction nulls informationGain with overrideAccess: true', async () => {
    await resetToDraftedAction(1, 'fixed the intro')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ informationGain: EXPECTED_NULL_INFORMATION_GAIN }),
        overrideAccess: true,
      }),
    )
  })

  it('sendBackAction nulls informationGain with overrideAccess: true', async () => {
    await sendBackAction(1, 'not on brand')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ informationGain: EXPECTED_NULL_INFORMATION_GAIN }),
        overrideAccess: true,
      }),
    )
  })

  it('regenerateArticleAction nulls informationGain with overrideAccess: true', async () => {
    await regenerateArticleAction(1, 'add a comparison table')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ informationGain: EXPECTED_NULL_INFORMATION_GAIN }),
        overrideAccess: true,
      }),
    )
  })
})

// A reset or regenerate throws the draft away, so every QA verdict about that
// draft has to go with it. `evidenceCheck` was the group the constant missed.
describe('reset and regenerate clear every QA result group', () => {
  const EXPECTED_QA_GROUPS = ['structural', 'factCheck', 'qualitativeReview', 'evidenceCheck']

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_revision',
      qaResults: undefined,
      revisionCount: 0,
    } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  const writtenQaResults = () =>
    (updateMock.mock.calls[0]?.[0]?.data as { qaResults: Record<string, Record<string, unknown>> })
      .qaResults

  for (const [name, run] of [
    ['resetToDraftedAction', () => resetToDraftedAction(1, 'fixed the intro')],
    ['regenerateArticleAction', () => regenerateArticleAction(1, 'add a table')],
  ] as const) {
    it(`${name} nulls every field of every group`, async () => {
      await run()
      const qaResults = writtenQaResults()
      expect(Object.keys(qaResults).sort()).toEqual([...EXPECTED_QA_GROUPS].sort())
      for (const group of Object.values(qaResults)) {
        expect(Object.values(group).every((value) => value === null)).toBe(true)
      }
    })
  }
})

// Send-back writes its own QA verdict (the reviewer's reason, as a failed
// qualitative review), but the evidence verdict belongs to the draft being
// sent back and must not survive it either.
describe('sendBackAction clears the evidence verdict it does not replace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  it('names all four QA groups and nulls evidenceCheck', async () => {
    await sendBackAction(1, 'not on brand')
    const { qaResults } = updateMock.mock.calls[0]?.[0]?.data as {
      qaResults: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(qaResults).sort()).toEqual(
      ['evidenceCheck', 'factCheck', 'qualitativeReview', 'structural'],
    )
    expect(qaResults.evidenceCheck).toEqual({ passed: null, notes: null, claims: null })
  })
})

// "Only approval moves an article to researched." Regenerate writes
// `researched` and reset writes `drafted`; before a brief is approved either
// one would start the writing without that approval.
describe('reset and regenerate refuse an article whose brief was never approved', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  for (const status of ['topic_selected', 'brief_review'] as const) {
    it(`refuses both at ${status} without writing anything`, async () => {
      findByIDMock.mockResolvedValue({ id: 1, status, revisionCount: 0 } as never)
      await expect(regenerateArticleAction(1, 'again')).resolves.toEqual({
        ok: false,
        error: expect.stringContaining('no approved brief yet, so it cannot be regenerated'),
      })
      await expect(resetToDraftedAction(1, 'again')).resolves.toEqual({
        ok: false,
        error: expect.stringContaining('no approved brief yet, so it cannot be reset'),
      })
      expect(updateMock).not.toHaveBeenCalled()
    })
  }

  // A stale page on a later status still works, and still clears what it should.
  it('still acts on an article that has a draft', async () => {
    findByIDMock.mockResolvedValue({ id: 1, status: 'approved', revisionCount: 0 } as never)
    await regenerateArticleAction(1, 'again')
    await resetToDraftedAction(1, 'again')
    expect(updateMock).toHaveBeenCalledTimes(2)
  })
})

describe('overrideReviewAction only overrides a decision that is waiting for one', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  for (const status of ['needs_review', 'blocked'] as const) {
    it(`overrides ${status} and records which decision it overrode`, async () => {
      findByIDMock.mockResolvedValue({ id: 1, status } as never)
      await overrideReviewAction(1, 'checked the sources by hand')
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'verified' }),
          overrideAccess: false,
          context: expect.objectContaining({
            articleAudit: expect.objectContaining({
              event: status === 'blocked' ? 'block_overridden' : 'review_overridden',
            }),
          }),
        }),
      )
    })
  }

  // The gates let these through (they only judge a move out of the two statuses
  // above), so without the action's own check a stale page wrote a second
  // "overrode needs_review" audit row for an override that never happened.
  for (const status of ['verified', 'approved', 'published', 'drafted'] as const) {
    it(`refuses ${status} without writing anything`, async () => {
      findByIDMock.mockResolvedValue({ id: 1, status } as never)
      await expect(overrideReviewAction(1, 'checked the sources by hand')).resolves.toEqual({
        ok: false,
        error: 'Only an article in Needs review or Blocked can be overridden.',
      })
      expect(updateMock).not.toHaveBeenCalled()
    })
  }
})

/**
 * Which run's reasons the next generate prompt gets. `regenerateArticleAction`
 * must read the article's *current* `informationGain.run` pointer, because the
 * newest run row for an article outlives the decision it produced: every
 * send-back nulls the summary, and `invalidateStaleInformationGain` nulls it
 * again on a content edit, while the row stays. Preferring that orphaned row
 * would aim the regeneration at a draft that no longer exists, in front of the
 * QA failures the draft in hand actually has.
 */
describe('regenerateArticleAction resolves the run through the current pointer', () => {
  const QA_FAILURE = {
    structural: {
      passed: false,
      violations: [
        {
          code: 'BANNED_PHRASE',
          phrase: 'game changer',
          field: 'body',
          context: '...a real game changer for fans...',
          source: 'platform',
        },
      ],
    },
  }

  /** `find` dispatched per collection, so a run row exists but is not linked. */
  const withRuns = (runs: { id: number; reasons: unknown }[]) => {
    findMock.mockImplementation(async ({ where }) => {
      const id = (where as { id?: { equals?: number } } | undefined)?.id?.equals
      return { docs: runs.filter((run) => run.id === id) } as never
    })
  }

  const revisionNotesSent = () => {
    const [call] = updateMock.mock.calls as unknown as { data: { revisionNotes: string } }[][]
    return call[0].data.revisionNotes
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
  })

  it('uses the linked run when the article still carries a pointer', async () => {
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_review',
      qaResults: QA_FAILURE,
      revisionCount: 0,
      informationGain: { run: 42, decision: 'HUMAN_REVIEW' },
    } as never)
    withRuns([
      {
        id: 42,
        reasons: [
          { policy: 'coverage', message: 'misses two consensus facets', severity: 'HUMAN_REVIEW' },
        ],
      },
      {
        id: 99,
        reasons: [
          { policy: 'noveltyFloor', message: 'from a draft thrown away', severity: 'REVISE' },
        ],
      },
    ])

    await regenerateArticleAction(1)

    expect(revisionNotesSent()).toBe('- [coverage] misses two consensus facets')
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'information-gain-runs',
        where: { id: { equals: 42 } },
      }),
    )
  })

  it('falls back to the QA failures when the pointer has been cleared', async () => {
    // The run row from the previous regeneration is still there; it must lose
    // to what is wrong with the draft actually being replaced.
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_revision',
      qaResults: QA_FAILURE,
      revisionCount: 1,
      informationGain: { run: null, decision: null },
    } as never)
    withRuns([
      {
        id: 99,
        reasons: [
          { policy: 'noveltyFloor', message: 'from a draft thrown away', severity: 'REVISE' },
        ],
      },
    ])

    await regenerateArticleAction(1)

    expect(revisionNotesSent()).toBe(
      '- [Structure] "game changer" appears in the body, and the platform style guide bans it. Remove "game changer" and say the same thing in plain words.',
    )
    // The only `find` left is the queue helper's active-run check.
    expect(findMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'information-gain-runs' }),
    )
  })

  it('sends only the reviewer note when there is neither a pointer nor a QA failure', async () => {
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'researched',
      qaResults: undefined,
      revisionCount: 0,
      informationGain: null,
    } as never)
    withRuns([])

    await regenerateArticleAction(1, 'add a comparison table')

    expect(revisionNotesSent()).toBe('Reviewer note: add a comparison table')
    // The only `find` left is the queue helper's active-run check.
    expect(findMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'information-gain-runs' }),
    )
  })

  it('treats a run row deleted since it was linked as no run at all', async () => {
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_review',
      qaResults: QA_FAILURE,
      revisionCount: 0,
      informationGain: { run: 42, decision: 'BLOCK' },
    } as never)
    withRuns([])

    await regenerateArticleAction(1)

    expect(revisionNotesSent()).toBe(
      '- [Structure] "game changer" appears in the body, and the platform style guide bans it. Remove "game changer" and say the same thing in plain words.',
    )
  })
})

/**
 * Both send-back actions now finish the job they start: an article that has
 * been reset or sent for regeneration is queued for a run, so nobody has to
 * find it on the board and tick it a second time. When the run cannot be
 * queued the action says so in `reason` rather than pretending it started —
 * the update itself has already happened either way.
 */
describe('resetToDraftedAction and regenerateArticleAction queue the run themselves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'needs_revision',
      qaResults: undefined,
      revisionCount: 0,
      template: 3,
    } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
    loadWorkspaceSetupMock.mockResolvedValue(readySetup())
    createPipelineRunMock.mockResolvedValue(undefined)
  })

  it('resetToDraftedAction queues a selected run for the article', async () => {
    const result = await resetToDraftedAction(1, 'fixed the intro')
    expect(result).toMatchObject({ ok: true, queued: true, runId: expect.any(String) })
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1] }),
    )
  })

  it('regenerateArticleAction queues a selected run for the article', async () => {
    const result = await regenerateArticleAction(1, 'tighten it')
    expect(result).toMatchObject({ ok: true, queued: true })
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1] }),
    )
  })

  it('regenerateArticleAction reports when a run is already active', async () => {
    createPipelineRunMock.mockRejectedValueOnce(new ActivePipelineRunError('run-42'))
    const result = await regenerateArticleAction(1, 'tighten it')
    expect(result).toEqual({
      ok: true,
      queued: false,
      reason: 'Run run-42 is already in progress.',
    })
  })

  it('still performs the update when the run cannot be queued', async () => {
    createPipelineRunMock.mockRejectedValueOnce(new ActivePipelineRunError('run-42'))
    await resetToDraftedAction(1, 'fixed the intro')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'drafted' }) }),
    )
  })

  it('names the governance problems instead of queueing a run that cannot work', async () => {
    loadWorkspaceSetupMock.mockResolvedValue(
      readySetup({
        governance: {
          ready: false,
          activeVoiceId: null,
          problems: ['Set the target domain', 'Add and activate at least one audience (ICP)'],
        },
      }),
    )
    const result = await resetToDraftedAction(1, 'fixed the intro')
    expect(result).toEqual({
      ok: true,
      queued: false,
      reason:
        'Finish setup before running the pipeline: Set the target domain; Add and activate at least one audience (ICP).',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('names the missing environment variables when the runtime is not ready', async () => {
    loadWorkspaceSetupMock.mockResolvedValue(
      readySetup({
        runtime: { ready: false, missing: ['OPENAI_API_KEY'], blockers: ['OPENAI_API_KEY'] },
      }),
    )
    const result = await regenerateArticleAction(1)
    expect(result).toEqual({
      ok: true,
      queued: false,
      reason: 'Configure the required environment variables: OPENAI_API_KEY.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('does not spend live money without confirmation, and queues when it is given', async () => {
    loadWorkspaceSetupMock.mockResolvedValue(readySetup({ mode: 'live' }))
    expect(await regenerateArticleAction(1)).toEqual({
      ok: true,
      queued: false,
      reason: 'Confirm the live provider cost before starting this run.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()

    const confirmed = await regenerateArticleAction(1, undefined, { confirmLiveCost: true })
    expect(confirmed).toMatchObject({ ok: true, queued: true })
  })

  it('skips the run entirely when the caller asks it to', async () => {
    const result = await resetToDraftedAction(1, 'fixed the intro', { queueRun: false })
    expect(result).toEqual({ ok: true, queued: false })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})

/**
 * Scheduling, unscheduling and archiving — the three things a reviewer can do
 * to a piece that is finished with the pipeline but not yet (or never) going
 * live. Each writes through the ordinary `overrideAccess: false` path with its
 * own audit event, because "who parked this and when" is exactly what someone
 * looking at an article nobody published needs to read months later.
 */
describe('scheduling, unscheduling and archiving', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findByIDMock.mockResolvedValue({ id: 1, status: 'approved' } as never)
    countMock.mockResolvedValue({ totalDocs: 0 } as never)
  })

  it('scheduleArticleAction rejects a past date', async () => {
    await expect(scheduleArticleAction(1, '2020-01-01T00:00:00Z')).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/future/),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('scheduleArticleAction rejects a value that is not a date at all', async () => {
    await expect(scheduleArticleAction(1, 'next tuesday')).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/date and time/),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('scheduleArticleAction stores publishAt with an audit context', async () => {
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'approved' } as never)
    await scheduleArticleAction(1, '2099-01-01T09:00:00Z')
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ publishAt: '2099-01-01T09:00:00.000Z' }),
        overrideAccess: false,
        context: expect.objectContaining({
          articleAudit: expect.objectContaining({ event: 'publish_scheduled' }),
        }),
      }),
    )
  })

  // `jobs/publishDue.ts` only ever picks up `approved`, so a date on anything
  // else is inert intent dressed up as a promise the page would then repeat.
  it('scheduleArticleAction refuses an article that is not approved', async () => {
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'needs_revision' } as never)
    await expect(scheduleArticleAction(1, '2099-01-01T09:00:00Z')).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/approved/),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('unscheduleArticleAction clears publishAt and records why', async () => {
    await unscheduleArticleAction(1)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { publishAt: null },
        context: expect.objectContaining({
          articleAudit: expect.objectContaining({ event: 'publish_unscheduled' }),
        }),
      }),
    )
  })

  // Undo needs the date that was taken off; nothing else remembers it.
  it('unscheduleArticleAction returns the date it took off, and Undo restores it', async () => {
    const prior = '2099-01-01T09:00:00.000Z'
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'approved', publishAt: prior } as never)
    await expect(unscheduleArticleAction(1)).resolves.toEqual({ ok: true, previousPublishAt: prior })

    // The inverse is an ordinary schedule at that instant, written as a new
    // audit event rather than by touching the one the unschedule left.
    updateMock.mockClear()
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'approved' } as never)
    await scheduleArticleAction(1, prior)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { publishAt: prior },
        context: expect.objectContaining({
          articleAudit: expect.objectContaining({ event: 'publish_scheduled' }),
        }),
      }),
    )
  })

  it('unscheduleArticleAction returns null when nothing was scheduled', async () => {
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'approved', publishAt: null } as never)
    await expect(unscheduleArticleAction(1)).resolves.toEqual({ ok: true, previousPublishAt: null })
  })

  it('archiveArticleAction refuses while a run is active', async () => {
    countMock.mockResolvedValueOnce({ totalDocs: 1 } as never)
    await expect(archiveArticleAction(1)).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/active run/),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  // Undo is unarchive. The audit trail is append-only, so it adds an event.
  it('Undo of an archive writes a new unarchived event and keeps the archived one', async () => {
    await archiveArticleAction(1)
    await unarchiveArticleAction(1)
    expect(updateMock).toHaveBeenCalledTimes(2)
    const events = updateMock.mock.calls.map(
      ([args]) =>
        (args as { context: { articleAudit: { event: string } } }).context.articleAudit.event,
    )
    expect(events).toEqual(['article_archived', 'article_unarchived'])
    expect(updateMock.mock.calls[1][0]).toMatchObject({ data: { archived: false } })
  })

  it('archiveArticleAction sets archived and records who did it', async () => {
    await archiveArticleAction(1)
    expect(countMock).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pipeline-runs' }))
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { archived: true },
        overrideAccess: false,
        context: expect.objectContaining({
          articleAudit: expect.objectContaining({
            event: 'article_archived',
            actor: 'reviewer@example.com',
          }),
        }),
      }),
    )
  })
})

/**
 * A schedule is inert on every status but `approved`, which is exactly what
 * makes leaving one behind dangerous: the date does nothing while the piece is
 * being reworked and then fires on the next five-minute tick the moment it is
 * approved again, publishing a draft nobody re-read.
 */
describe('moving an article off approved takes its schedule with it', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findByIDMock.mockResolvedValue({
      id: 1,
      status: 'approved',
      publishAt: '2099-01-01T09:00:00.000Z',
      revisionCount: 0,
      template: 3,
    } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
    loadWorkspaceSetupMock.mockResolvedValue(readySetup())
    createPipelineRunMock.mockResolvedValue(undefined)
  })

  const dataSent = () => (updateMock.mock.calls[0][0] as { data: Record<string, unknown> }).data
  const auditSent = () =>
    (
      updateMock.mock.calls[0][0] as {
        context: { articleAudit: { details?: Record<string, unknown> } }
      }
    ).context.articleAudit

  it('sendBackAction clears publishAt and records the clear', async () => {
    await sendBackAction(1, 'the third section is wrong')
    expect(dataSent().publishAt).toBeNull()
    expect(auditSent().details).toMatchObject({ publishAt: null })
  })

  it('resetToDraftedAction clears publishAt', async () => {
    await resetToDraftedAction(1, 'fixed the intro')
    expect(dataSent().publishAt).toBeNull()
    expect(auditSent().details).toMatchObject({ publishAt: null })
  })

  it('regenerateArticleAction clears publishAt', async () => {
    await regenerateArticleAction(1, 'tighten it')
    expect(dataSent().publishAt).toBeNull()
    expect(auditSent().details).toMatchObject({ publishAt: null })
  })

  /**
   * The approved panel's Send back used to hand over the note the *approving*
   * reviewer had left, which landed "reads well" on the draft as the reason
   * the qualitative check failed. A reason is required now, so a blank one is
   * refused instead of being replaced with a placeholder.
   */
  it('sendBackAction rejects an empty or whitespace reason and writes nothing', async () => {
    await expect(sendBackAction(1, '')).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/why/i),
    })
    await expect(sendBackAction(1, '   \n ')).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/why/i),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('sendBackAction stores the reason in reviewNotes and the chip code in the audit details', async () => {
    await sendBackAction(1, '  The third section has no source.  ', 'weak_evidence')
    const data = dataSent() as {
      reviewNotes: string
      qaResults: { qualitativeReview: { notes: string; passed: boolean } }
    }
    expect(data.reviewNotes).toBe('The third section has no source.')
    expect(data.qaResults.qualitativeReview).toMatchObject({
      passed: false,
      notes: 'The third section has no source.',
    })
    expect(auditSent().details).toMatchObject({
      reviewNotes: 'The third section has no source.',
      reasonCode: 'weak_evidence',
    })
  })

  it('sendBackAction records no code when none was picked, and refuses an unknown one', async () => {
    await sendBackAction(1, 'Needs another pass')
    expect(auditSent().details).toMatchObject({ reasonCode: null })
    updateMock.mockClear()
    await expect(sendBackAction(1, 'x', 'bogus' as never)).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/reason/i),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

/**
 * Approve and publish used to answer with nothing and let the page navigate
 * away. The reviewer stays put now, so the action has to say what the article
 * became — the panel that replaces the one they just used is chosen from it.
 */
describe('approve and publish report the status they left behind', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
  })

  it('approveArticleAction returns the approved status', async () => {
    await expect(approveArticleAction(1, 'reads well')).resolves.toEqual({ ok: true, status: 'approved' })
  })

  it('publishArticleAction returns the published status and the slug to link to', async () => {
    updateMock.mockResolvedValueOnce({ id: 1, status: 'published', slug: 'cold-brew' } as never)
    await expect(publishArticleAction(1)).resolves.toEqual({
      ok: true,
      status: 'published',
      slug: 'cold-brew',
    })
  })

  it('publishArticleAction returns a null slug for a piece that has none', async () => {
    updateMock.mockResolvedValueOnce({ id: 1, status: 'published' } as never)
    await expect(publishArticleAction(1)).resolves.toEqual({ ok: true, status: 'published', slug: null })
  })
})

/**
 * Next redacts the message of an error thrown from a server action in a
 * production build, so a refusal the reviewer has to read must come back as a
 * value. These pin that for the gate's own wording, the signed-out case and an
 * unexpected failure.
 */
describe('refusals arrive as { ok: false, error } instead of a throw', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
    findByIDMock.mockResolvedValue({ id: 1, status: 'needs_review' } as never)
  })

  it("carries the gate's APIError message through unchanged", async () => {
    const message = 'Moving an article from needs_review to verified requires a new reviewJustification'
    updateMock.mockRejectedValueOnce(new APIError(message, 400))
    await expect(overrideReviewAction(1, 'checked by hand')).resolves.toEqual({
      ok: false,
      error: message,
    })
  })

  it('does the same for the approve, publish and archive writes', async () => {
    for (const run of [
      () => approveArticleAction(1),
      () => publishArticleAction(1),
      () => archiveArticleAction(1),
      () => unarchiveArticleAction(1),
    ]) {
      updateMock.mockRejectedValueOnce(
        new APIError('An article cannot move from drafted to approved.', 400),
      )
      await expect(run()).resolves.toEqual({
        ok: false,
        error: 'An article cannot move from drafted to approved.',
      })
    }
  })

  it('answers a signed-out caller with the message instead of throwing', async () => {
    authMock.mockResolvedValue({ user: null } as never)
    await expect(sendBackAction(1, 'because')).resolves.toEqual({ ok: false, error: 'Unauthorized' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('still reports an unexpected failure rather than a redacted throw', async () => {
    updateMock.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    await expect(approveArticleAction(1)).resolves.toEqual({
      ok: false,
      error: 'connection terminated unexpectedly',
    })
  })
})

// A reset writes `drafted`, which queues QA over the body. At `researched` the brief is
// approved but nothing has been written, so there is no body to check.
describe('resetToDraftedAction refuses an article that has no draft yet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    findMock.mockResolvedValue({ docs: [] } as never)
  })

  it('refuses researched, writes nothing, and says why', async () => {
    findByIDMock.mockResolvedValue({ id: 1, status: 'researched' } as never)
    await expect(resetToDraftedAction(1, 'again')).resolves.toEqual({
      ok: false,
      error: expect.stringContaining('has not been drafted yet'),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('leaves regenerate working at researched', async () => {
    findByIDMock.mockResolvedValue({ id: 1, status: 'researched', revisionCount: 0 } as never)
    await expect(regenerateArticleAction(1, 'again')).resolves.toMatchObject({ ok: true })
    expect(updateMock).toHaveBeenCalledTimes(1)
  })
})

// Archiving a published piece withdraws it from the public site
// (`findPublishedArticle` skips archived rows), but the page is ISR-cached, so
// the cache has to be purged by the action or the piece stays up for minutes.
describe('archiving and unarchiving a published piece purges its public page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    countMock.mockResolvedValue({ totalDocs: 0 } as never)
  })

  const purged = () => revalidatePathMock.mock.calls.map(([path]) => path as string)

  it('purges /articles/<id> and /articles/<slug> on archive and on unarchive', async () => {
    updateMock.mockResolvedValue({ id: 1, status: 'published', slug: 'cold-brew' } as never)
    await archiveArticleAction(1)
    expect(purged()).toEqual(expect.arrayContaining(['/articles/1', '/articles/cold-brew']))
    revalidatePathMock.mockClear()
    await unarchiveArticleAction(1)
    expect(purged()).toEqual(expect.arrayContaining(['/articles/1', '/articles/cold-brew']))
  })

  it('leaves the public cache alone for a piece that was never public', async () => {
    updateMock.mockResolvedValue({ id: 1, status: 'approved', slug: 'cold-brew' } as never)
    await archiveArticleAction(1)
    expect(purged().filter((path) => path.startsWith('/articles/'))).toEqual([])
  })
})
