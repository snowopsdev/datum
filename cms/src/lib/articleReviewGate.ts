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
 * The information-gain decision this update will leave on the article: the
 * incoming value when the write carries one, otherwise the persisted one.
 *
 * Incoming-first because the informationGain stage writes the decision and the
 * status in a *single* update — reading only `originalDoc` would reject the
 * very write the gate exists to permit. A hand-written decision arriving from
 * the admin or REST is not a way around that: the `informationGain` group is
 * `access.update: () => false`, so a request without `overrideAccess` never
 * gets to persist one.
 */
function decisionOf(doc: unknown): string | undefined {
  const group = (doc as { informationGain?: { decision?: unknown } } | null | undefined)
    ?.informationGain
  return typeof group?.decision === 'string' ? group.decision : undefined
}

/**
 * The reviewer's fresh justification, trimmed, or null when this update does
 * not carry one. "Fresh" means different from the persisted value: the admin UI
 * submits the whole document, so a justification written for an earlier review
 * would otherwise ride along and satisfy the gate without anyone typing.
 *
 * Shared by both gates rather than re-derived, so `gateVerifiedStatus` reaches
 * the same verdict as `gateReviewOverride` no matter which order they run in.
 * It is idempotent on an already-trimmed `data`, which is what makes running
 * second harmless.
 */
export function freshJustification(
  data: Record<string, unknown>,
  originalDoc: Record<string, unknown> | undefined,
): string | null {
  const justification =
    typeof data.reviewJustification === 'string' ? data.reviewJustification.trim() : ''
  const previous =
    typeof originalDoc?.reviewJustification === 'string'
      ? originalDoc.reviewJustification.trim()
      : ''
  if (!justification || justification === previous) return null
  return justification
}

/** The decision that means the scoring stage cleared the draft on its own. */
export const PASSING_DECISION = 'PASS'

/**
 * `verified` means "information gain scored this draft and it passed". Nothing
 * else may assert it.
 *
 * Without this the whole gate is advisory: `Article.informationGain` is a
 * pipeline-written group with no field access of its own, so an admin could set
 * `decision: 'PASS'` and `status: 'verified'` in two ordinary edits and reach
 * `approved` having skipped scoring entirely. Field access alone does not close
 * it either — that stops the decision being *written*, not the status being
 * moved to `verified` beside a decision that was never earned. Both halves are
 * needed, and this is the half that owns the transition.
 *
 * Two ways in, and only two: the article carries a `PASS` decision (the stage's
 * own write, or a re-save of an article the stage already passed), or a
 * reviewer is overriding out of `needs_review`/`blocked` with a new
 * justification — the deliberate, audited human path that `gateReviewOverride`
 * governs. A re-save that leaves an already-`verified` article at `verified` is
 * not a transition and passes through.
 */
export const gateVerifiedStatus: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (data.status !== 'verified') return data
  const from = originalDoc?.status as string | undefined
  if (from === 'verified') return data

  if (from && OVERRIDABLE_STATUSES.includes(from as never)) {
    if (freshJustification(data, originalDoc)) return data
    throw new APIError(
      `Moving an article from ${from} to verified requires a new reviewJustification`,
      400,
    )
  }

  const decision = decisionOf(data) ?? decisionOf(originalDoc)
  if (decision !== PASSING_DECISION) {
    throw new APIError(
      'An article reaches verified only through information-gain scoring or a reviewed ' +
        `override; this one has decision ${decision ?? 'none'}${from ? ` and status ${from}` : ''}`,
      400,
    )
  }
  return data
}

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
  const justification = freshJustification(data, originalDoc)
  if (!justification) {
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
