import { beforeEach, describe, expect, it, vi } from 'vitest'

import { gateReviewOverride, gateVerifiedStatus } from '@/lib/articleReviewGate'
import { buildRegenerateRevisionNotes, qaFailureLines } from '@/components/ops/articleStatus'

// Mocked so resetToDraftedAction/sendBackAction/regenerateArticleAction can run outside a
// real Next.js request scope and a real Payload instance below. `payload` itself keeps its
// real exports (importOriginal) — gateReviewOverride/gateVerifiedStatus above import
// `APIError` from it, and a bare replacement would break those.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'reviewer@example.com' } }))
const findByIDMock = vi.fn(
  async () => ({ id: 1, status: 'needs_revision', qaResults: undefined, revisionCount: 0 }) as never,
)
const findMock = vi.fn(async (_args: { collection?: string; where?: unknown }) => ({ docs: [] }) as never)
const updateMock = vi.fn(async () => ({}) as never)

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
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
    expect(notes).toBe('- Fact: unsupported stat')
  })

  it('falls back to qaFailureLines when the run has no reasons', () => {
    const notes = buildRegenerateRevisionNotes({ reasons: [] }, {
      qaResults: { qualitativeReview: { passed: false, notes: 'too salesy' } },
    } as never)
    expect(notes).toBe('- Style: too salesy')
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
    structural: { passed: false, violations: [{ code: 'BANNED_PHRASE', message: 'found "game changer"' }] },
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

    expect(revisionNotesSent()).toBe('- BANNED_PHRASE — found "game changer"')
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

    expect(revisionNotesSent()).toBe('- BANNED_PHRASE — found "game changer"')
  })
})
