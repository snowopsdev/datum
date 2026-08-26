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
 * The information-gain decision already persisted on a document, or undefined
 * when it carries none.
 *
 * Only ever a fallback: the informationGain stage writes the decision and the
 * status in a *single* update, so `incomingDecision` is consulted first —
 * reading only `originalDoc` would reject the very write the gate exists to
 * permit. A hand-written decision arriving from the admin or REST is not a way
 * around that: the `informationGain` group is `access.update: () => false`, so
 * a request without `overrideAccess` never gets to persist one.
 */
function persistedDecision(doc: unknown): string | undefined {
  const group = (doc as { informationGain?: { decision?: unknown } } | null | undefined)
    ?.informationGain
  return typeof group?.decision === 'string' ? group.decision : undefined
}

/**
 * The decision this update is *writing*: the string when it carries one, `null`
 * when it explicitly clears the group, `undefined` when it does not speak about
 * the group at all.
 *
 * The three cases have to stay distinct because `invalidateStaleInformationGain`
 * runs first and clears the group in place. Collapsing its `null` into
 * `undefined` would send `gateVerifiedStatus` back to `originalDoc` and let it
 * authorise `verified` on the very PASS that was just invalidated.
 */
function incomingDecision(data: Record<string, unknown>): string | null | undefined {
  const group = data.informationGain as Record<string, unknown> | null | undefined
  if (group === undefined) return undefined
  if (group === null) return null
  if (!('decision' in group)) return undefined
  return typeof group.decision === 'string' ? group.decision : null
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

  const incoming = incomingDecision(data)
  const decision = incoming !== undefined ? incoming : persistedDecision(originalDoc)
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

/**
 * The article fields the information-gain stage actually reads when it scores a
 * draft: the text it pulls claims out of (`title`, `body`), the query it scores
 * that text against (`keyword`), and the baseline it compares the claims to
 * (`research.snapshot`, `research.queryCluster`, `research.facets`).
 *
 * Derived from `informationGainStage.run` in
 * `pipeline/src/informationGain/index.ts` — every path here is read there, and
 * nothing read there is missing here. Keep the two in step: a field the stage
 * starts scoring but that is absent from this list is a field an editor can
 * change under a decision without invalidating it.
 *
 * The absences are deliberate, not oversights. `titleTag`, `metaDescription`,
 * `ogTitle`/`ogDescription`/`ogImage` and `faqItems` are checked by structural
 * QA but never reach the scorer, so editing one cannot make its verdict wrong.
 * Neither can the rest of the `research` group (`rankingPagesSummary`,
 * `commonSubtopics`, `relatedQuestions`, `gaps`), which feeds the generate
 * prompt rather than the scoring passes.
 */
export const SCORED_CONTENT_FIELDS = [
  'title',
  'body',
  'keyword',
  'research.snapshot',
  'research.queryCluster',
  'research.facets',
] as const

/**
 * The all-null `informationGain` payload. Exported so the ops actions that send
 * an article back for rework and this hook clear the group to one identical
 * shape — a group cleared field-by-field in two places drifts the moment a
 * field is added to it.
 */
export const CLEARED_INFORMATION_GAIN = {
  run: null,
  decision: null,
  policyVersion: null,
  consensusCoverage: null,
  verifiedGainUnits: null,
  verificationRatio: null,
  internalDuplicationRate: null,
  verifiedNovelClaims: null,
  scoredAt: null,
} as const

/** `undefined` and `null` both mean "no value" on a Payload document. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a === null || a === undefined) && (b === null || b === undefined)
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
  }
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => sameValue(item, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  // Union of the keys, so a key present on one side and absent on the other is
  // compared (and, when the present one holds null/undefined, still equal).
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!sameValue(left[key], right[key])) return false
  }
  return true
}

/** Reads a dotted path such as `research.facets`. */
function valueAt(doc: Record<string, unknown> | undefined, path: string): unknown {
  let current: unknown = doc
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * A decision describes one specific draft. Change that draft and the decision
 * stops being about anything that exists, so this clears it.
 *
 * Both gates above fire only on status *transitions*, which leaves the whole
 * other half of the surface open: editing the body of an already-`verified`
 * article is not a transition, so it kept a `PASS` earned by text nobody can
 * read any more — and `gateVerifiedStatus` would happily spend that same PASS
 * to authorise a later move back to `verified`. Clearing here closes the gate's
 * blind spot at its source rather than adding another transition rule.
 *
 * Clearing is possible from a collection `beforeChange` hook even though the
 * group is `access.update: () => false`, because Payload enforces *field*
 * access during the beforeValidate-fields phase, which runs before collection
 * `beforeChange` (see `payload/dist/collections/operations/utilities/update.js`
 * — beforeValidate fields → beforeValidate collection → beforeChange collection
 * → beforeChange fields). By the time this runs, a denied group has already
 * been reverted to its persisted value and nothing re-checks what we write. The
 * same phase order is why `data` is a *complete* document here: Payload fills
 * every field the request omitted with a clone of the persisted value, so a
 * partial REST update compares equal on everything it did not send.
 *
 * A `verified` article that stays `verified` (or is being pushed on to
 * `approved`/`published`) also goes back to `drafted`. Clearing the decision
 * alone would not be enough: `gateVerifiedStatus` never fires on a re-save at
 * `verified`, and nothing gates `verified → approved`, so unscored text could
 * still walk to publication — just without a verdict beside it. `drafted` is
 * the status the pipeline can converge from on its own: `qaStage` picks it up,
 * and a pass there feeds it straight back into scoring at `qa_passed`. An edit
 * that already sends the article backwards keeps the status it asked for.
 */
export const invalidateStaleInformationGain: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
}) => {
  // A create has nothing scored to invalidate.
  if (!originalDoc) return data
  if (persistedDecision(originalDoc) === undefined) return data
  const original = originalDoc as Record<string, unknown>
  // A write that authors a *new* verdict owns the group outright — that is the
  // scoring stage re-scoring the draft. Merely carrying a decision is not
  // enough to qualify: Payload refills every field the request omitted from the
  // persisted document, so the group the admin panel submits on an ordinary
  // save is byte-for-byte the one already stored.
  if (
    typeof incomingDecision(data) === 'string' &&
    !sameValue(data.informationGain, original.informationGain)
  ) {
    return data
  }

  const changed = SCORED_CONTENT_FIELDS.some(
    (path) => !sameValue(valueAt(data, path), valueAt(original, path)),
  )
  if (!changed) return data

  data.informationGain = { ...CLEARED_INFORMATION_GAIN }
  if (
    original.status === 'verified' &&
    !UNGATED_OVERRIDE_TARGETS.includes(data.status as never)
  ) {
    data.status = 'drafted'
  }
  return data
}
