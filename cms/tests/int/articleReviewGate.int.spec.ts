import { describe, expect, it } from 'vitest'

import {
  gateReviewOverride,
  OVERRIDABLE_STATUSES,
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
