import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

import type { ArticleAuditContext } from './articleAudit'

export const OVERRIDABLE_STATUSES = ['needs_review', 'blocked'] as const

/**
 * The forward statuses an override can land on. `verified` is the ops UI's own
 * button, but `approved` and `published` are selectable in the admin/REST API
 * too, and jumping straight to one of them advances the article just as far — so
 * all three are gated identically rather than letting the longer jump skip the
 * justification.
 */
export const OVERRIDE_TARGET_STATUSES = ['verified', 'approved', 'published'] as const

/**
 * Moving a needs_review or blocked article forward — to verified, approved, or
 * published — requires a *new* reviewJustification, enforced here so REST/admin
 * edits obey it too, not just the ops UI. The admin UI submits the whole
 * document, so a justification persisted by an earlier override would otherwise
 * ride along and satisfy the gate without a reviewer typing anything. Sending
 * the article back (needs_revision, drafted, researched) or resaving it in place
 * is not an override and passes through untouched, as does every transition that
 * does not start from a review state.
 */
export const gateReviewOverride: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  req,
  context,
}) => {
  const from = originalDoc?.status as string | undefined
  const to = data.status as string | undefined
  if (!from || !OVERRIDABLE_STATUSES.includes(from as never)) return data
  if (!to || !OVERRIDE_TARGET_STATUSES.includes(to as never)) return data
  const justification =
    typeof data.reviewJustification === 'string' ? data.reviewJustification.trim() : ''
  const previous =
    typeof originalDoc?.reviewJustification === 'string'
      ? originalDoc.reviewJustification.trim()
      : ''
  if (!justification || justification === previous) {
    throw new APIError(
      `Moving an article from ${from} to ${to} requires a new reviewJustification`,
      400,
    )
  }
  data.reviewJustification = justification
  const user = req.user as { email?: string; id?: number | string } | null | undefined
  data.reviewedBy ??= user?.email ?? (user?.id != null ? String(user.id) : 'system')
  const ctx = context as { articleAudit?: ArticleAuditContext }
  if (!ctx.articleAudit) {
    // The event names describe what is being audited — the override itself — so
    // a direct jump to approved/published reuses them and carries the target
    // status in `details` instead of inventing a second pair of event names.
    ctx.articleAudit = {
      event: from === 'blocked' ? 'block_overridden' : 'review_overridden',
      summary:
        to === 'verified'
          ? `Reviewer overrode ${from}`
          : `Reviewer overrode ${from} straight to ${to}`,
      details: { justification, targetStatus: to },
    }
  }
  return data
}
