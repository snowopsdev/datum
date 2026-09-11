import type { Payload, TypedUser } from 'payload'

/**
 * Which articles a pipeline run is actually carrying right now.
 *
 * "Datum is working on this" is a claim about a `pipeline-runs` row, not about
 * the article's status: a status like `researched` only means a run *would*
 * pick the piece up. Both screens that make that claim — the content list and
 * the article review page — resolve it here so they cannot disagree, and so
 * "active" has one definition.
 */

/** A run that has not settled: the job is waiting or executing. */
export const ACTIVE_RUN_STATUSES = ['queued', 'running'] as const

/**
 * Every article id listed on a `queued` or `running` run.
 *
 * One query for the whole page rather than one per row. `articles` is a
 * `hasMany` relationship (`collections/PipelineRuns.ts`), so at depth 0 it
 * arrives as ids; a populated row is tolerated because `depth` is the caller's
 * business, not this function's contract.
 */
export async function activeRunArticleIds(
  payload: Payload,
  user: TypedUser | null,
): Promise<Set<number>> {
  const { docs } = await payload.find({
    collection: 'pipeline-runs',
    where: { status: { in: [...ACTIVE_RUN_STATUSES] } },
    select: { articles: true },
    pagination: false,
    limit: 100,
    depth: 0,
    user: user ?? undefined,
    overrideAccess: false,
  })
  const ids = new Set<number>()
  for (const run of docs) {
    if (!Array.isArray(run.articles)) continue
    for (const article of run.articles) {
      const id = typeof article === 'number' ? article : article?.id
      if (typeof id === 'number') ids.add(id)
    }
  }
  return ids
}

/**
 * Whether an active run lists this one article.
 *
 * A count rather than `activeRunArticleIds().has(id)`: the review page asks
 * about a single article, and pushing the predicate into the query keeps it
 * O(1) rows however many runs the workspace has accumulated.
 */
export async function activeRunIncludesArticle(
  payload: Payload,
  user: TypedUser | null,
  articleId: number,
): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'pipeline-runs',
    where: {
      and: [{ status: { in: [...ACTIVE_RUN_STATUSES] } }, { articles: { in: [articleId] } }],
    },
    user: user ?? undefined,
    overrideAccess: false,
  })
  return totalDocs > 0
}
