import type { CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'

import type { ArticleAuditContext } from './articleAudit'

export const OVERRIDABLE_STATUSES = ['needs_review', 'blocked'] as const

/**
 * The only statuses a needs_review/blocked article may be moved to *without* a
 * fresh justification: genuinely backward ones that send the work back to be
 * redone, plus the review statuses themselves (re-saving in place, or moving
 * between needs_review and blocked, still leaves the article gated).
 *
 * This is deliberately an allow-list of backward targets rather than a list of
 * forward ones. Enumerating the forward targets makes every status that is not
 * on the list default to *ungated*, so each new status — or each one whose
 * meaning shifts — silently opens another detour out of review. That is exactly
 * how `qa_passed` slipped through: it is not "forward" in the reviewer's mental
 * model, but `ArticleReview.tsx` offers Approve at `qa_passed`, so an editor
 * could reach `approved` in two ungated edits. Inverting the rule makes the
 * failure mode an unexpected 400 that a reviewer reports, not a bypass nobody
 * notices.
 */
export const UNGATED_OVERRIDE_TARGETS = [
  'needs_revision',
  'drafted',
  'researched',
  'topic_selected',
  ...OVERRIDABLE_STATUSES,
] as const

/**
 * Moving a needs_review or blocked article anywhere other than backward — so to
 * qa_passed, verified, approved, or published — requires a *new*
 * reviewJustification, enforced here so REST/admin edits obey it too, not just
 * the ops UI. The admin UI submits the whole document, so a justification
 * persisted by an earlier override would otherwise ride along and satisfy the
 * gate without a reviewer typing anything; for the same reason `reviewedBy` is
 * overwritten with the current actor rather than left at whatever value the
 * submitted document carried. Sending the article back, re-saving it in place,
 * and every transition that does not start from a review state pass through
 * untouched.
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
  // An edit that does not touch `status` is not a transition at all.
  if (!to || UNGATED_OVERRIDE_TARGETS.includes(to as never)) return data
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
  data.reviewedBy = user?.email ?? (user?.id != null ? String(user.id) : 'system')
  const ctx = context as { articleAudit?: ArticleAuditContext }
  if (!ctx.articleAudit) {
    // The event names describe what is being audited — the override itself — so
    // a direct jump to qa_passed/approved/published reuses them and carries the
    // target status in `details` instead of inventing more event names.
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
