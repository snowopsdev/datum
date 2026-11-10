import type { Payload, TypedUser } from 'payload'

import { loadSourceReviewArticles } from './sourceReviewData'
import { type CandidateDTO, queueBucket, toCandidateDTO } from './sourceReviewTypes'

/** Cards past this, per status, are not work anybody is going to get through in one sitting. */
export const CANDIDATE_LIMIT = 200

export type SourceReviewTotals = { review: number; rated: number; dismissed: number }

/**
 * The review queue, one query per status.
 *
 * One query for every status, newest first, would let a long tail of rated and
 * dismissed domains push older pending ones out of the page: past the cap they
 * could not be reached at all, and the tab counts counted only what was loaded.
 * So pending is read on its own, with its own cap, and each tab's total comes
 * from the database. The "covered by a rule" check stays on the loaded rows:
 * a rule is not a column on the candidate, so it can only be judged per row.
 */
export async function loadSourceReviewQueue(
  payload: Payload,
  user: TypedUser,
): Promise<{ candidates: CandidateDTO[]; totals: SourceReviewTotals }> {
  const read = (status: 'pending' | 'approved' | 'dismissed') =>
    payload.find({
      collection: 'evidence-source-candidates',
      where: { status: { equals: status } },
      depth: 0,
      limit: CANDIDATE_LIMIT,
      sort: '-lastSeenAt',
      user,
      overrideAccess: false,
    })

  const [pending, approved, dismissed, { docs: ruleDocs }] = await Promise.all([
    read('pending'),
    read('approved'),
    read('dismissed'),
    // Include inactive rules: a card must know when a rule no longer covers it.
    payload.find({
      collection: 'evidence-sources',
      depth: 0,
      pagination: false,
      user,
      overrideAccess: false,
    }),
  ])

  const candidateDocs = [...pending.docs, ...approved.docs, ...dismissed.docs]
  // One lookup for every article named in a sighting, so a card can say which
  // article is waiting on this domain rather than just showing an id.
  const articleIds = [
    ...new Set(
      candidateDocs.flatMap((doc) =>
        Array.isArray(doc.sightings)
          ? doc.sightings
              .map((s) =>
                s && typeof s === 'object' ? (s as { articleId?: unknown }).articleId : null,
              )
              .filter((id): id is number => typeof id === 'number')
          : [],
      ),
    ),
  ]
  const articles = await loadSourceReviewArticles(payload, user, articleIds)
  const candidates = candidateDocs.map((doc) => toCandidateDTO(doc, ruleDocs, articles))

  // A pending row an active rule covers is settled work: it moves from the
  // review total to the rated one.
  const covered = candidates.filter(
    (candidate) => candidate.status === 'pending' && queueBucket(candidate) === 'rated',
  ).length
  return {
    candidates,
    totals: {
      review: pending.totalDocs - covered,
      rated: approved.totalDocs + covered,
      dismissed: dismissed.totalDocs,
    },
  }
}
