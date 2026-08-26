import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

export const OVERRIDABLE_STATUSES = ['needs_review', 'blocked'] as const

/**
 * Overriding a needs_review or blocked article straight to verified requires
 * a reviewJustification, enforced here so REST/admin edits obey it too, not
 * just the ops UI. Every other transition passes through untouched.
 */
export const gateReviewOverride: CollectionBeforeChangeHook = ({ data, originalDoc, req, context }) => {
  const from = originalDoc?.status as string | undefined
  const to = data.status as string | undefined
  if (to !== 'verified' || !from || !OVERRIDABLE_STATUSES.includes(from as never)) return data
  const justification = typeof data.reviewJustification === 'string' ? data.reviewJustification.trim() : ''
  if (!justification) {
    throw new APIError(`Moving an article from ${from} to verified requires a reviewJustification`, 400)
  }
  data.reviewJustification = justification
  const user = req.user as { email?: string; id?: number | string } | null | undefined
  data.reviewedBy ??= user?.email ?? (user?.id != null ? String(user.id) : 'system')
  const ctx = context as { articleAudit?: unknown }
  if (!ctx.articleAudit) {
    ctx.articleAudit = {
      event: from === 'blocked' ? 'block_overridden' : 'review_overridden',
      summary: `Reviewer overrode ${from}`,
      details: { justification },
    }
  }
  return data
}
