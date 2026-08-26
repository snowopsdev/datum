import { describe, expect, it } from 'vitest'

import {
  CLEARED_INFORMATION_GAIN,
  gateReviewOverride,
  gateVerifiedStatus,
  invalidateStaleInformationGain,
  OVERRIDABLE_STATUSES,
  PASSING_DECISION,
  SCORED_CONTENT_FIELDS,
  UNGATED_OVERRIDE_TARGETS,
} from '@/lib/articleReviewGate'

describe('article review-override gate', () => {
  it('throws when moving needs_review to verified without a justification', () => {
    expect(() =>
      gateReviewOverride({
        data: { status: 'verified' },
        originalDoc: { status: 'needs_review' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('reviewJustification')
  })

  it('throws when the justification is only whitespace', () => {
    expect(() =>
      gateReviewOverride({
        data: { status: 'verified', reviewJustification: '   ' },
        originalDoc: { status: 'blocked' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('reviewJustification')
  })

  it('throws when the justification is unchanged from the persisted one', () => {
    // The admin UI submits the whole document, so a justification persisted by
    // an earlier override would otherwise ride along and satisfy the gate.
    expect(() =>
      gateReviewOverride({
        data: { status: 'verified', reviewJustification: '  same reason as last time  ' },
        originalDoc: { status: 'blocked', reviewJustification: 'same reason as last time' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('new reviewJustification')
  })

  it('accepts a justification that differs from the persisted one', () => {
    const result = gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'a fresh reason' },
      originalDoc: { status: 'blocked', reviewJustification: 'the previous reason' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result.reviewJustification).toBe('a fresh reason')
  })

  it('passes and trims a valid justification, stamping reviewedBy from the user email', () => {
    const data: Record<string, unknown> = {
      status: 'verified',
      reviewJustification: '  looks fine, manually verified  ',
    }
    const context: Record<string, unknown> = {}

    const result = gateReviewOverride({
      data,
      originalDoc: { status: 'needs_review' },
      req: { user: { id: 7, email: 'reviewer@example.com' } },
      context,
    } as never) as Record<string, unknown>

    expect(result.reviewJustification).toBe('looks fine, manually verified')
    expect(result.reviewedBy).toBe('reviewer@example.com')
  })

  it('falls back to the user id, then "system", when no email is present', () => {
    const withId = gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'ok' },
      originalDoc: { status: 'needs_review' },
      req: { user: { id: 7 } },
      context: {},
    } as never) as Record<string, unknown>
    expect(withId.reviewedBy).toBe('7')

    const withNoUser = gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'ok' },
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(withNoUser.reviewedBy).toBe('system')
  })

  it('sets context.articleAudit.event to review_overridden from needs_review', () => {
    const context: Record<string, unknown> = {}
    gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'ok' },
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context,
    } as never)
    expect((context.articleAudit as { event?: string })?.event).toBe('review_overridden')
  })

  it('sets context.articleAudit.event to block_overridden from blocked', () => {
    const context: Record<string, unknown> = {}
    gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'ok' },
      originalDoc: { status: 'blocked' },
      req: { user: null },
      context,
    } as never)
    expect((context.articleAudit as { event?: string })?.event).toBe('block_overridden')
  })

  it('does not override a pre-set context.articleAudit', () => {
    const context: Record<string, unknown> = {
      articleAudit: { event: 'custom_event', summary: 'preset' },
    }
    gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'ok' },
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context,
    } as never)
    expect(context.articleAudit).toEqual({ event: 'custom_event', summary: 'preset' })
  })

  it('leaves qa_passed to verified untouched (not an override transition)', () => {
    // gateReviewOverride only governs transitions *out of* a review status.
    // The qa_passed -> verified path is gateVerifiedStatus's business; see the
    // "verified is reachable only through scoring" block below.
    const data = { status: 'verified' }
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data,
      originalDoc: { status: 'qa_passed' },
      req: { user: null },
      context,
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
    expect(result.reviewJustification).toBeUndefined()
    expect(context.articleAudit).toBeUndefined()
  })

  it('leaves needs_review to needs_revision untouched', () => {
    const data = { status: 'needs_revision' }
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data,
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context,
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
    expect(context.articleAudit).toBeUndefined()
  })

  it('leaves create operations (no originalDoc) untouched', () => {
    const data = { status: 'topic_selected' }
    const result = gateReviewOverride({
      data,
      originalDoc: undefined,
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })

  it.each(['qa_passed', 'approved', 'published'])(
    'throws when jumping a needs_review article straight to %s without a justification',
    (target) => {
      expect(() =>
        gateReviewOverride({
          data: { status: target },
          originalDoc: { status: 'needs_review' },
          req: { user: null },
          context: {},
        } as never),
      ).toThrow('reviewJustification')
    },
  )

  it.each(['qa_passed', 'approved', 'published'])(
    'throws when jumping a blocked article straight to %s reusing the persisted justification',
    (target) => {
      expect(() =>
        gateReviewOverride({
          data: { status: target, reviewJustification: 'same reason as last time' },
          originalDoc: { status: 'blocked', reviewJustification: 'same reason as last time' },
          req: { user: null },
          context: {},
        } as never),
      ).toThrow('new reviewJustification')
    },
  )

  it('audits a needs_review to approved jump as review_overridden with the target status', () => {
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data: { status: 'approved', reviewJustification: '  shipping it anyway  ' },
      originalDoc: { status: 'needs_review' },
      req: { user: { id: 7, email: 'reviewer@example.com' } },
      context,
    } as never) as Record<string, unknown>

    expect(result.reviewJustification).toBe('shipping it anyway')
    expect(result.reviewedBy).toBe('reviewer@example.com')
    expect(context.articleAudit).toEqual({
      event: 'review_overridden',
      summary: 'Reviewer overrode needs_review straight to approved',
      details: { justification: 'shipping it anyway', targetStatus: 'approved' },
    })
  })

  it('audits a blocked to published jump as block_overridden with the target status', () => {
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data: { status: 'published', reviewJustification: 'legal signed off' },
      originalDoc: { status: 'blocked' },
      req: { user: null },
      context,
    } as never) as Record<string, unknown>

    expect(result.reviewedBy).toBe('system')
    expect(context.articleAudit).toEqual({
      event: 'block_overridden',
      summary: 'Reviewer overrode blocked straight to published',
      details: { justification: 'legal signed off', targetStatus: 'published' },
    })
  })

  it('keeps the verified target on the plain override summary and details', () => {
    const context: Record<string, unknown> = {}
    gateReviewOverride({
      data: { status: 'verified', reviewJustification: 'checked by hand' },
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context,
    } as never)
    expect(context.articleAudit).toEqual({
      event: 'review_overridden',
      summary: 'Reviewer overrode needs_review',
      details: { justification: 'checked by hand', targetStatus: 'verified' },
    })
  })

  it.each([
    ['needs_review', 'needs_revision'],
    ['needs_review', 'drafted'],
    ['needs_review', 'researched'],
    ['needs_review', 'needs_review'],
    ['blocked', 'needs_revision'],
    ['blocked', 'drafted'],
    ['blocked', 'researched'],
    ['blocked', 'blocked'],
  ])('leaves %s to %s untouched', (from_, to) => {
    const data = { status: to }
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data,
      originalDoc: { status: from_ },
      req: { user: null },
      context,
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
    expect(result.reviewJustification).toBeUndefined()
    expect(result.reviewedBy).toBeUndefined()
    expect(context.articleAudit).toBeUndefined()
  })

  it.each(['approved', 'published'])(
    'leaves qa_passed to %s untouched (not an override transition)',
    (target) => {
      const data = { status: target }
      const context: Record<string, unknown> = {}
      const result = gateReviewOverride({
        data,
        originalDoc: { status: 'qa_passed' },
        req: { user: null },
        context,
      } as never) as Record<string, unknown>
      expect(result).toBe(data)
      expect(context.articleAudit).toBeUndefined()
    },
  )

  it('leaves an edit that does not touch status untouched', () => {
    const data = { reviewJustification: 'a note typed while still in review' }
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data,
      originalDoc: { status: 'needs_review' },
      req: { user: null },
      context,
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
    expect(context.articleAudit).toBeUndefined()
  })

  it('audits a needs_review to qa_passed hop as an override with the target status', () => {
    // The reviewer's detour: qa_passed is Approve-eligible in ArticleReview.tsx,
    // so reaching it from review must cost a justification like verified does.
    const context: Record<string, unknown> = {}
    const result = gateReviewOverride({
      data: { status: 'qa_passed', reviewJustification: 'rerunning QA by hand' },
      originalDoc: { status: 'needs_review' },
      req: { user: { id: 7, email: 'reviewer@example.com' } },
      context,
    } as never) as Record<string, unknown>

    expect(result.reviewedBy).toBe('reviewer@example.com')
    expect(context.articleAudit).toEqual({
      event: 'review_overridden',
      summary: 'Reviewer overrode needs_review straight to qa_passed',
      details: { justification: 'rerunning QA by hand', targetStatus: 'qa_passed' },
    })
  })

  it('overwrites a stale reviewedBy submitted with the document', () => {
    // The stock admin submits the whole document, so the previous reviewer's
    // value rides along; the override must be attributed to the current actor.
    const result = gateReviewOverride({
      data: {
        status: 'verified',
        reviewJustification: 'a fresh reason',
        reviewedBy: 'previous@example.com',
      },
      originalDoc: { status: 'needs_review', reviewedBy: 'previous@example.com' },
      req: { user: { id: 9, email: 'current@example.com' } },
      context: {},
    } as never) as Record<string, unknown>
    expect(result.reviewedBy).toBe('current@example.com')
  })

  it('overwrites a stale reviewedBy with "system" when the request is unauthenticated', () => {
    const result = gateReviewOverride({
      data: {
        status: 'approved',
        reviewJustification: 'a fresh reason',
        reviewedBy: 'previous@example.com',
      },
      originalDoc: { status: 'blocked' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result.reviewedBy).toBe('system')
  })

  it('exports the exact overridable statuses and ungated targets', () => {
    expect(OVERRIDABLE_STATUSES).toEqual(['needs_review', 'blocked'])
    expect(UNGATED_OVERRIDE_TARGETS).toEqual([
      'needs_revision',
      'drafted',
      'researched',
      'topic_selected',
      'needs_review',
      'blocked',
    ])
  })
})

describe('verified is reachable only through scoring or a reviewed override', () => {
  const scored = (decision: string) => ({ informationGain: { decision } })

  it('refuses a hand-set qa_passed to verified with no scoring run', () => {
    // The two-move bypass this gate exists for: without it an editor reaches
    // approved having never been scored.
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: { status: 'qa_passed' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('only through information-gain scoring')
  })

  it('names the decision it found in the error', () => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: { status: 'qa_passed', ...scored('BLOCK') },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('decision BLOCK')

    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: { status: 'qa_passed' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('decision none')
  })

  it.each(['REVISE', 'HUMAN_REVIEW', 'BLOCK'])('refuses a persisted %s decision', (decision) => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: { status: 'qa_passed', ...scored(decision) },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('only through information-gain scoring')
  })

  it('allows the transition when the article already carries a persisted PASS', () => {
    const data = { status: 'verified' }
    const result = gateVerifiedStatus({
      data,
      originalDoc: { status: 'qa_passed', ...scored(PASSING_DECISION) },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })

  it('allows the stage-shaped write that sets the decision and the status together', () => {
    // Exactly what runPipeline sends: one update carrying the whole
    // `informationGain` summary alongside the new status. Reading only
    // originalDoc here would reject the one write the gate exists to permit.
    const data = {
      status: 'verified',
      informationGain: {
        run: 12,
        decision: 'PASS',
        policyVersion: 'ig-v1:2a9ee80976c03c4b',
        consensusCoverage: 1,
        verifiedGainUnits: 2.08,
        verificationRatio: 0.957,
        internalDuplicationRate: 0,
        verifiedNovelClaims: 2,
        scoredAt: '2026-08-26T15:05:08.029Z',
      },
      totalCostUsd: 0.87,
    }
    const result = gateVerifiedStatus({
      data,
      originalDoc: { status: 'qa_passed' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })

  it('refuses a stage-shaped write whose decision is not PASS', () => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified', informationGain: { decision: 'BLOCK' } },
        originalDoc: { status: 'qa_passed', ...scored(PASSING_DECISION) },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('decision BLOCK')
  })

  it('refuses a create that asserts verified out of nowhere', () => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: undefined,
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('decision none')
  })

  it.each([...OVERRIDABLE_STATUSES])(
    'allows the %s override when the reviewer supplies a fresh justification',
    (from) => {
      const data = { status: 'verified', reviewJustification: 'checked the sources by hand' }
      const result = gateVerifiedStatus({
        data,
        originalDoc: { status: from, reviewJustification: null },
        req: { user: null },
        context: {},
      } as never) as Record<string, unknown>
      expect(result).toBe(data)
    },
  )

  it.each([...OVERRIDABLE_STATUSES])('refuses the %s override with no justification', (from) => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified' },
        originalDoc: { status: from },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('requires a new reviewJustification')
  })

  it('refuses the override when the justification is the persisted one reused', () => {
    expect(() =>
      gateVerifiedStatus({
        data: { status: 'verified', reviewJustification: '  same reason as last time ' },
        originalDoc: { status: 'blocked', reviewJustification: 'same reason as last time' },
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('requires a new reviewJustification')
  })

  it('does not depend on hook order: it accepts data gateReviewOverride already trimmed', () => {
    // gateReviewOverride runs first and rewrites data.reviewJustification to
    // its trimmed form. gateVerifiedStatus must still see that as fresh.
    const originalDoc = { status: 'needs_review', reviewJustification: 'an older reason' }
    const data: Record<string, unknown> = {
      status: 'verified',
      reviewJustification: '  a fresh reason  ',
    }
    gateReviewOverride({ data, originalDoc, req: { user: null }, context: {} } as never)
    expect(data.reviewJustification).toBe('a fresh reason')

    const result = gateVerifiedStatus({
      data,
      originalDoc,
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })

  it('leaves a re-save of an already-verified article untouched', () => {
    const data = { status: 'verified', title: 'a retitled article' }
    const result = gateVerifiedStatus({
      data,
      originalDoc: { status: 'verified' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })

  it.each(['approved', 'published', 'needs_revision', 'qa_passed', 'drafted'])(
    'ignores a transition to %s entirely',
    (target) => {
      const data = { status: target }
      const result = gateVerifiedStatus({
        data,
        originalDoc: { status: 'qa_passed' },
        req: { user: null },
        context: {},
      } as never) as Record<string, unknown>
      expect(result).toBe(data)
    },
  )

  it('ignores an edit that does not touch status', () => {
    const data = { title: 'a retitled article' }
    const result = gateVerifiedStatus({
      data,
      originalDoc: { status: 'qa_passed' },
      req: { user: null },
      context: {},
    } as never) as Record<string, unknown>
    expect(result).toBe(data)
  })
})

/**
 * `invalidateStaleInformationGain` is the half of the gate that watches
 * *content* rather than transitions. Payload hands a collection `beforeChange`
 * hook a complete document — every field the request omitted is pre-filled from
 * the persisted one — so these fixtures spell out the whole scored surface the
 * way the real hook sees it.
 */
describe('stale information-gain invalidation', () => {
  const body = { root: { type: 'root', children: [{ type: 'paragraph', text: 'as scored' }] } }
  const facets = [{ id: 'f0', label: 'grind size' }]

  const scoredContent = () => ({
    title: 'Best Burr Grinders',
    keyword: 'burr grinders',
    body: structuredClone(body),
    research: {
      rankingPagesSummary: 'five pages',
      snapshot: 41,
      queryCluster: [{ id: 'q0', text: 'burr grinders' }],
      facets: structuredClone(facets),
      gaps: [],
    },
    titleTag: 'Best Burr Grinders (2026)',
    metaDescription: 'A guide.',
    faqItems: [{ question: 'Which?', answer: 'This one.' }],
  })

  const PASS_SUMMARY = {
    run: 9,
    decision: 'PASS',
    policyVersion: 'v3',
    consensusCoverage: 0.8,
    verifiedGainUnits: 4,
    verificationRatio: 0.7,
    internalDuplicationRate: 0.1,
    verifiedNovelClaims: 3,
    scoredAt: '2026-08-01T00:00:00.000Z',
  }

  const verifiedDoc = () => ({
    ...scoredContent(),
    status: 'verified',
    informationGain: { ...PASS_SUMMARY },
  })

  /** The hook, called the way Payload calls it. */
  const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    invalidateStaleInformationGain({ data, originalDoc, req: { user: null }, context: {} } as never) as Record<
      string,
      unknown
    >

  const summaryOf = (result: Record<string, unknown>) =>
    result.informationGain as Record<string, unknown> | undefined

  for (const [what, mutate] of [
    ['body', (d: Record<string, unknown>) => ((d.body as typeof body).root.children[0].text = 'rewritten')],
    ['title', (d: Record<string, unknown>) => (d.title = 'A Different Headline')],
    ['keyword', (d: Record<string, unknown>) => (d.keyword = 'conical burr grinders')],
    [
      'research.facets',
      (d: Record<string, unknown>) =>
        ((d.research as { facets: unknown }).facets = [{ id: 'f1', label: 'burr material' }]),
    ],
    [
      'research.snapshot',
      (d: Record<string, unknown>) => ((d.research as { snapshot: unknown }).snapshot = 77),
    ],
    [
      'research.queryCluster',
      (d: Record<string, unknown>) =>
        ((d.research as { queryCluster: unknown }).queryCluster = [{ id: 'q1', text: 'best grinder' }]),
    ],
  ] as const) {
    it(`clears the decision and leaves verified when ${what} changes`, () => {
      const data = verifiedDoc()
      mutate(data as unknown as Record<string, unknown>)
      const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
      expect(summaryOf(result)).toEqual(CLEARED_INFORMATION_GAIN)
      expect(result.status).toBe('drafted')
    })
  }

  it('leaves an untouched re-save alone, whatever order the keys arrive in', () => {
    // The admin UI submits the whole document on every save; a no-op save must
    // not cost the article its decision.
    const data = verifiedDoc()
    data.research = {
      gaps: [],
      facets: structuredClone(facets),
      queryCluster: [{ id: 'q0', text: 'burr grinders' }],
      snapshot: 41,
      rankingPagesSummary: 'five pages',
    } as never
    const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
    expect(summaryOf(result)).toEqual(PASS_SUMMARY)
    expect(result.status).toBe('verified')
  })

  it('ignores fields the scorer never reads', () => {
    // Structural QA checks these; the information-gain stage never sees them,
    // so editing one cannot make its verdict wrong. See SCORED_CONTENT_FIELDS.
    const data = verifiedDoc()
    data.titleTag = 'Best Burr Grinders (2027)'
    data.metaDescription = 'A better guide.'
    data.faqItems = [{ question: 'Which?', answer: 'A different one.' }]
    const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
    expect(summaryOf(result)).toEqual(PASS_SUMMARY)
    expect(result.status).toBe('verified')
  })

  it('names only fields the scoring stage reads', () => {
    expect([...SCORED_CONTENT_FIELDS]).toEqual([
      'title',
      'body',
      'keyword',
      'research.snapshot',
      'research.queryCluster',
      'research.facets',
    ])
  })

  it('leaves the generate stage alone when it writes a draft with no decision on it', () => {
    // researched → drafted: generateStage rewrites title/body/meta wholesale on
    // an article that carries no decision, so there is nothing to invalidate
    // and nothing to demote.
    const original = { ...scoredContent(), status: 'researched', informationGain: { decision: null } }
    const data = {
      ...scoredContent(),
      status: 'drafted',
      title: 'A Freshly Generated Title',
      body: { root: { type: 'root', children: [{ type: 'paragraph', text: 'brand new' }] } },
      metaDescription: 'Fresh meta.',
      informationGain: { decision: null },
    }
    const result = run(data as unknown as Record<string, unknown>, original as never)
    expect(result.status).toBe('drafted')
    expect(summaryOf(result)).toEqual({ decision: null })
  })

  it('leaves the scoring stage alone when it writes a fresh verdict', () => {
    // qa_passed → verified: the stage writes status and summary together and
    // touches no content. Its own verdict must survive its own write.
    const original = { ...scoredContent(), status: 'qa_passed', informationGain: { decision: null } }
    const data = { ...scoredContent(), status: 'verified', informationGain: { ...PASS_SUMMARY } }
    const result = run(data as unknown as Record<string, unknown>, original as never)
    expect(summaryOf(result)).toEqual(PASS_SUMMARY)
    expect(result.status).toBe('verified')
    // And the transition gate accepts it, so the happy path still ends verified.
    expect(
      (gateVerifiedStatus({ data: result, originalDoc: original, req: { user: null }, context: {} } as never) as
        Record<string, unknown>).status,
    ).toBe('verified')
  })

  it('re-scoring wins over an older decision even when content moved with it', () => {
    const data = verifiedDoc()
    ;(data.body as typeof body).root.children[0].text = 'rewritten'
    data.informationGain = { ...PASS_SUMMARY, run: 10, decision: 'REVISE' }
    const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
    expect((summaryOf(result) as { decision: string }).decision).toBe('REVISE')
  })

  it('sends a verified article being pushed on to approved back to drafted', () => {
    // Nothing gates verified → approved, so leaving the status alone would let
    // text nobody scored walk all the way to publication.
    const data = { ...verifiedDoc(), status: 'approved' }
    ;(data.body as typeof body).root.children[0].text = 'rewritten'
    const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
    expect(result.status).toBe('drafted')
    expect(summaryOf(result)).toEqual(CLEARED_INFORMATION_GAIN)
  })

  it('keeps the target of an edit that already sends the article backwards', () => {
    for (const target of UNGATED_OVERRIDE_TARGETS) {
      const data = { ...verifiedDoc(), status: target }
      ;(data.body as typeof body).root.children[0].text = 'rewritten'
      const result = run(data as unknown as Record<string, unknown>, verifiedDoc())
      expect(result.status).toBe(target)
      expect(summaryOf(result)).toEqual(CLEARED_INFORMATION_GAIN)
    }
  })

  it('clears the decision without moving an article that is past verified', () => {
    // Demoting a published article would unpublish it behind the editor's back;
    // the stale verdict still has to go.
    const original = { ...verifiedDoc(), status: 'published' }
    const data = { ...verifiedDoc(), status: 'published' }
    ;(data.body as typeof body).root.children[0].text = 'rewritten'
    const result = run(data as unknown as Record<string, unknown>, original)
    expect(summaryOf(result)).toEqual(CLEARED_INFORMATION_GAIN)
    expect(result.status).toBe('published')
  })

  it('does nothing on a create', () => {
    const data = { ...scoredContent(), status: 'topic_selected' }
    expect(run(data as unknown as Record<string, unknown>, undefined).status).toBe('topic_selected')
  })

  it('stops the cleared decision from authorising a later move to verified', () => {
    // The whole point: an edited draft must not be able to spend the PASS its
    // previous text earned. Both hooks, in the order Articles.ts runs them.
    const original = { ...scoredContent(), status: 'qa_passed', informationGain: { ...PASS_SUMMARY } }
    const data = { ...scoredContent(), status: 'verified', informationGain: { ...PASS_SUMMARY } }
    ;(data.body as typeof body).root.children[0].text = 'rewritten by hand'
    const afterInvalidation = run(data as unknown as Record<string, unknown>, original)
    expect(() =>
      gateVerifiedStatus({
        data: afterInvalidation,
        originalDoc: original,
        req: { user: null },
        context: {},
      } as never),
    ).toThrow('decision none')
  })
})
