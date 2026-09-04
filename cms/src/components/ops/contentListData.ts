import type { PayloadRequest, Where } from 'payload'

import { ARTICLE_STATUSES, STATUS_META } from '../../lib/articleStatusMeta'
import type { BoardArticle } from './articleStatus'

export type ContentFilter = 'you' | 'working' | 'done' | 'all'
export type ContentRow = Pick<
  BoardArticle,
  'id' | 'title' | 'keyword' | 'status' | 'templateName' | 'totalCostUsd' | 'updatedAt'
>
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

export async function loadContentPage(
  req: PayloadRequest,
  params: Record<string, string | string[] | undefined> = {},
): Promise<ContentPage> {
  const read = (key: string) => (Array.isArray(params[key]) ? params[key][0] : params[key])
  const filters = ['you', 'working', 'done'] as const
  const totals = await Promise.all(
    filters.map((filter) =>
      req.payload.count({
        collection: 'articles',
        user: req.user,
        overrideAccess: false,
        where: { and: [active, { status: { in: statusesFor(filter) } }] },
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
      ...(filter === 'all' ? [] : [{ status: { in: statusesFor(filter) } }]),
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
      totalCostUsd: doc.totalCostUsd ?? null,
      updatedAt: doc.updatedAt,
      templateName: typeof doc.template === 'object' && doc.template ? doc.template.name : null,
    })),
  }
}
