import { beforeEach, describe, expect, it, vi } from 'vitest'

import { gateReviewOverride, gateVerifiedStatus } from '@/lib/articleReviewGate'
import { buildRegenerateRevisionNotes, qaFailureLines } from '@/components/ops/articleStatus'

// Mocked so resetToDraftedAction/sendBackAction/regenerateArticleAction can run outside a
// real Next.js request scope and a real Payload instance below. `payload` itself keeps its
// real exports (importOriginal) — gateReviewOverride/gateVerifiedStatus above import
// `APIError` from it, and a bare replacement would break those.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'reviewer@example.com' } }))
const findByIDMock = vi.fn(
  async () =>
    ({ id: 1, status: 'needs_revision', qaResults: undefined, revisionCount: 0, template: 3 }) as never,
)
const findMock = vi.fn(async (_args: { collection?: string; where?: unknown }) => ({ docs: [] }) as never)
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
const { createPipelineRunMock, loadWorkspaceSetupMock } = vi.hoisted(() => ({
  createPipelineRunMock: vi.fn(),
  loadWorkspaceSetupMock: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
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
const { regenerateArticleAction, resetToDraftedAction, sendBackAction } = await import(
  '@/components/ops/actions'
)

describe('qaFailureLines', () => {
  it('returns an empty list when there are no qaResults', () => {
    expect(qaFailureLines({})).toEqual([])
    expect(qaFailureLines({ qaResults: undefined })).toEqual([])
  })

  it('formats plain-string structural violations', () => {
    expect(
      qaFailureLines({
        qaResults: { structural: { passed: false, violations: ['Missing H2: FAQ'] } },
      } as never),
    ).toEqual(['Missing H2: FAQ'])
  })

  it('formats code+message structural violations', () => {
    expect(
      qaFailureLines({
        qaResults: {
          structural: {
            passed: false,
            violations: [{ code: 'BANNED_PHRASE', message: 'found "game changer"' }],
          },
        },
      } as never),
    ).toEqual(['BANNED_PHRASE — found "game changer"'])
  })

  it('formats a code-only violation with no message', () => {
    expect(
      qaFailureLines({
        qaResults: { structural: { passed: false, violations: [{ code: 'TITLE_TOO_LONG' }] } },
      } as never),
    ).toEqual(['TITLE_TOO_LONG'])
  })

  it('includes fact-check notes only when the check failed', () => {
    expect(
      qaFailureLines({
        qaResults: { factCheck: { passed: false, notes: 'unsupported claim about pricing' } },
      } as never),
    ).toEqual(['Fact: unsupported claim about pricing'])
    expect(
      qaFailureLines({
        qaResults: { factCheck: { passed: true, notes: 'looked fine' } },
      } as never),
    ).toEqual([])
  })

  it('includes qualitative-review notes only when the check failed', () => {
    expect(
      qaFailureLines({
        qaResults: { qualitativeReview: { passed: false, notes: 'off brand voice' } },
      } as never),
    ).toEqual(['Style: off brand voice'])
    expect(
      qaFailureLines({
        qaResults: { qualitativeReview: { passed: true, notes: 'on brand' } },
      } as never),
    ).toEqual([])
  })

  it('combines every failing check into one list, in order', () => {
    expect(
      qaFailureLines({
        qaResults: {
          structural: { passed: false, violations: [{ code: 'FAQ_COUNT' }] },
          factCheck: { passed: false, notes: 'bad source' },
          qualitativeReview: { passed: false, notes: 'too salesy' },
        },
      } as never),
    ).toEqual(['FAQ_COUNT', 'Fact: bad source', 'Style: too salesy'])
  })
})

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

  it('falls back to qaFailureLines when there is no run', () => {
    const notes = buildRegenerateRevisionNotes(null, {
      qaResults: { factCheck: { passed: false, notes: 'unsupported stat' } },
    } as never)
    expect(notes).toBe(
      '- [Fact check] unsupported stat Correct each of these, and keep every other fact as it stands. Cite a source for anything you change.',
    )
  })

  it('falls back to qaFailureLines when the run has no reasons', () => {
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
    expect(notes).toBe(
      '- [noveltyFloor] thin\n\nReviewer note: please add a comparison table',
    )
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

// overrideReviewAction sends { status: 'verified', reviewJustification, reviewedBy } through
// the same beforeChange chain as any other write — gateReviewOverride then gateVerifiedStatus
// (see Articles.ts). These simulate that exact shape end to end.
describe('overrideReviewAction write shape through both gates', () => {
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
      { id: 42, reasons: [{ policy: 'coverage', message: 'misses two consensus facets', severity: 'HUMAN_REVIEW' }] },
      { id: 99, reasons: [{ policy: 'noveltyFloor', message: 'from a draft thrown away', severity: 'REVISE' }] },
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
      { id: 99, reasons: [{ policy: 'noveltyFloor', message: 'from a draft thrown away', severity: 'REVISE' }] },
    ])

    await regenerateArticleAction(1)

    expect(revisionNotesSent()).toBe(
      '- [Structure] "game changer" appears in the body, and the platform style guide bans it. Remove "game changer" and say the same thing in plain words.',
    )
    expect(findMock).not.toHaveBeenCalled()
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
    expect(findMock).not.toHaveBeenCalled()
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
    findByIDMock.mockResolvedValueOnce({ id: 1, status: 'needs_revision', template: 3 } as never)
    const result = await resetToDraftedAction(1, 'fixed the intro')
    expect(result.queued).toBe(true)
    expect(result.runId).toEqual(expect.any(String))
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1] }),
    )
  })

  it('regenerateArticleAction queues a selected run for the article', async () => {
    const result = await regenerateArticleAction(1, 'tighten it')
    expect(result.queued).toBe(true)
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1] }),
    )
  })

  it('regenerateArticleAction reports when a run is already active', async () => {
    createPipelineRunMock.mockRejectedValueOnce(new ActivePipelineRunError('run-42'))
    const result = await regenerateArticleAction(1, 'tighten it')
    expect(result).toEqual({ queued: false, reason: 'Run run-42 is already in progress.' })
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
      queued: false,
      reason:
        'Finish setup before running the pipeline: Set the target domain; Add and activate at least one audience (ICP).',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('names the missing environment variables when the runtime is not ready', async () => {
    loadWorkspaceSetupMock.mockResolvedValue(
      readySetup({ runtime: { ready: false, missing: ['OPENAI_API_KEY'], blockers: ['OPENAI_API_KEY'] } }),
    )
    const result = await regenerateArticleAction(1)
    expect(result).toEqual({
      queued: false,
      reason: 'Configure the required environment variables: OPENAI_API_KEY.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('does not spend live money without confirmation, and queues when it is given', async () => {
    loadWorkspaceSetupMock.mockResolvedValue(readySetup({ mode: 'live' }))
    expect(await regenerateArticleAction(1)).toEqual({
      queued: false,
      reason: 'Confirm the live provider cost before starting this run.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()

    const confirmed = await regenerateArticleAction(1, undefined, { confirmLiveCost: true })
    expect(confirmed.queued).toBe(true)
  })

  it('skips the run entirely when the caller asks it to', async () => {
    const result = await resetToDraftedAction(1, 'fixed the intro', { queueRun: false })
    expect(result).toEqual({ queued: false })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalled()
  })
})
