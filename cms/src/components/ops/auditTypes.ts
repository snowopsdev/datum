import type { AuditTimelineEntry } from './articleStatus'

export type AuditSource = { kind: 'audit' | 'cost'; recordId: number }
export type AuditSummary = Omit<AuditTimelineEntry, 'details'> & { source: AuditSource }
export type AuditDetailResult = { ok: true; details: unknown } | { ok: false; error: string }

/**
 * The audit event `invalidateStaleInformationGain` records when an edit to a
 * scored field costs a verified article its information-gain verdict.
 *
 * It lives here rather than in `lib/articleReviewGate.ts` because both sides
 * need it and this module has no runtime dependencies: the hook writes the
 * event, the review page reads it back to explain the demotion, and the
 * timeline labels it.
 */
export const SCORE_INVALIDATED_EVENT = 'score_invalidated'

const SCORE_INVALIDATED_PREFIX = 'Score invalidated by an edit to '

/**
 * The audit summary for a score invalidation. Built here so the wording has one
 * home and `scoreInvalidatedFields` can read the field list back out of it.
 */
export const scoreInvalidatedSummary = (fields: readonly string[]): string =>
  `${SCORE_INVALIDATED_PREFIX}${fields.join(', ')}`

/**
 * The edited fields named by a `score_invalidated` summary, or null when the
 * summary is not one this version wrote.
 *
 * The review page needs the field list, and the audit row's `details` are
 * deliberately not part of the timeline query (`AuditEvidence` fetches them on
 * demand), so the summary is what it has. Returning null rather than guessing
 * keeps a row written by an older build from producing a nonsense notice.
 */
export const scoreInvalidatedFields = (summary: string): string | null => {
  if (!summary.startsWith(SCORE_INVALIDATED_PREFIX)) return null
  return summary.slice(SCORE_INVALIDATED_PREFIX.length).trim() || null
}

/** Event names whose underscores do not read as a label. */
const AUDIT_EVENT_LABELS: Record<string, string> = {
  [SCORE_INVALIDATED_EVENT]: 'Score invalidated by edit',
}

/** How an audit `event` is shown to a reviewer. Mirrors `humanize` in `lib/articleAudit.ts`. */
export const auditEventLabel = (event: string): string =>
  AUDIT_EVENT_LABELS[event] ?? event.replace(/_/g, ' ')

/**
 * The fields to name in the review page's "score cleared" notice, or null when
 * there is nothing to explain.
 *
 * Only the newest *audit* row counts: `auditEntries` interleaves model-call
 * rows from the cost log, which are not things anybody did, and anything an
 * actor did after the invalidation (a run, a send-back) makes the demotion
 * stale news. The `drafted` check is what keeps the notice off an article that
 * has since moved on.
 */
export function scoreInvalidationNotice(
  status: string,
  entries: readonly Pick<AuditSummary, 'event' | 'source' | 'summary'>[],
): string | null {
  if (status !== 'drafted') return null
  const newest = entries.find((entry) => entry.source.kind === 'audit')
  if (newest?.event !== SCORE_INVALIDATED_EVENT) return null
  return scoreInvalidatedFields(newest.summary)
}
