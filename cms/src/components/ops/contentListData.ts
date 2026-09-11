import type { PayloadRequest, Where } from 'payload'

import { activeRunArticleIds } from '../../lib/activeRuns'
import { ARTICLE_STATUSES, STATUS_META } from '../../lib/articleStatusMeta'
import type { BoardArticle } from './articleStatus'
import { isStalled } from './articleStatus'

export type ContentFilter = 'you' | 'working' | 'done' | 'all'
export type ContentRow = Pick<
  BoardArticle,
  'id' | 'title' | 'keyword' | 'status' | 'templateName' | 'totalCostUsd' | 'updatedAt'
> & {
  /**
   * A run would advance this piece, and no run is. It belongs under "Needs
   * you" with a Run button, not under "In progress" claiming work is happening.
   */
  stalled: boolean
}
export type ContentPage = {
  articles: ContentRow[]
  counts: Record<ContentFilter, number>
  filter: ContentFilter
  q: string
  page: number
  totalPages: number
  totalDocs: number
}
export const CONTENT_PAGE_SIZE = 50
const active: Where = { archived: { not_equals: true } }
const statusesFor = (filter: Exclude<ContentFilter, 'all'>) =>
  ARTICLE_STATUSES.filter(
    (status) => STATUS_META[status].owner === (filter === 'working' ? 'run' : filter),
  )
/** Matches nothing. Article ids are positive, so this is an empty result set. */
const MATCHES_NOTHING: Where = { id: { equals: -1 } }

/**
 * Which tab a piece belongs on, given the articles an active run is carrying.
 *
 * The tabs used to partition on `STATUS_META[status].owner` alone, which put
 * every run-owned status under "In progress" whether or not a run existed. A
 * piece a run would advance but nothing is advancing is work waiting on a
 * person to press Run, so it moves to "Needs you" — and "In progress" now
 * means what it says: these articles are on a `queued` or `running` run.
 */
function whereForFilter(filter: Exclude<ContentFilter, 'all'>, activeIds: number[]): Where {
  if (filter === 'done') return { status: { in: statusesFor('done') } }
  const runStatuses = { status: { in: statusesFor('working') } }
  if (filter === 'working') {
    return activeIds.length === 0
      ? MATCHES_NOTHING
      : { and: [runStatuses, { id: { in: activeIds } }] }
  }
  return {
    or: [
      { status: { in: statusesFor('you') } },
      activeIds.length === 0 ? runStatuses : { and: [runStatuses, { id: { not_in: activeIds } }] },
    ],
  }
}

export async function loadContentPage(
  req: PayloadRequest,
  params: Record<string, string | string[] | undefined> = {},
): Promise<ContentPage> {
  const read = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key])
  // Resolved once for the whole page: the tab counts, the `where` behind the
  // visible rows, and each row's own `stalled` flag are three views of the
  // same fact and must not be answered by three separate queries.
  const activeRunIds = await activeRunArticleIds(req.payload, req.user)
  const activeIds = [...activeRunIds]
  const filters = ['you', 'working', 'done'] as const
  const totals = await Promise.all(
    filters.map((filter) =>
      req.payload.count({
        collection: 'articles',
        user: req.user,
        overrideAccess: false,
        where: { and: [active, whereForFilter(filter, activeIds)] },
      }),
    ),
  )
  const counts = {
    you: totals[0].totalDocs,
    working: totals[1].totalDocs,
    done: totals[2].totalDocs,
    all: totals.reduce((n, t) => n + t.totalDocs, 0),
  }
  const rawFilter = read('filter')
  const filter =
    rawFilter === 'you' || rawFilter === 'working' || rawFilter === 'done' || rawFilter === 'all'
      ? rawFilter
      : counts.you > 0
        ? 'you'
        : 'all'
  const q = (read('q') ?? '').trim()
  const rawPage = Number(read('page') ?? 1)
  let page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const where: Where = {
    and: [
      active,
      ...(filter === 'all' ? [] : [whereForFilter(filter, activeIds)]),
      ...(q ? [{ or: [{ title: { contains: q } }, { keyword: { contains: q } }] }] : []),
    ],
  }
  const findPage = (page: number) =>
    req.payload.find({
      collection: 'articles',
      where,
      page,
      limit: CONTENT_PAGE_SIZE,
      pagination: true,
      sort: ['-updatedAt', '-id'],
      depth: 1,
      user: req.user,
      overrideAccess: false,
      select: {
        title: true,
        keyword: true,
        status: true,
        template: true,
        totalCostUsd: true,
        updatedAt: true,
      },
      populate: { templates: { name: true } },
    })
  let result = await findPage(page)
  if (page > Math.max(1, result.totalPages)) {
    page = Math.max(1, result.totalPages)
    result = await findPage(page)
  }
  return {
    counts,
    filter,
    q,
    page,
    totalDocs: result.totalDocs,
    totalPages: Math.max(1, result.totalPages),
    articles: result.docs.map((doc) => ({
      id: doc.id,
      title: doc.title ?? null,
      keyword: doc.keyword,
      status: doc.status,
      stalled: isStalled(doc.status, activeRunIds.has(doc.id)),
      totalCostUsd: doc.totalCostUsd ?? null,
      updatedAt: doc.updatedAt,
      templateName: typeof doc.template === 'object' && doc.template ? doc.template.name : null,
    })),
  }
}
