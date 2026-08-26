import { describe, expect, it } from 'vitest'

import { gateReviewOverride, OVERRIDABLE_STATUSES } from '@/lib/articleReviewGate'

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

  it('exports the exact overridable statuses', () => {
    expect(OVERRIDABLE_STATUSES).toEqual(['needs_review', 'blocked'])
  })
})
