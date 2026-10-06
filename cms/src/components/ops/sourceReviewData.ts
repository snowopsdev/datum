import type { Payload, TypedUser } from 'payload'
import type { ArticleLookup } from './sourceReviewTypes'

/** Only the labels a source-review sighting needs, never article evidence. */
export async function loadSourceReviewArticles(
  payload: Payload,
  user: TypedUser,
  articleIds: number[],
): Promise<ArticleLookup> {
  const articles: ArticleLookup = new Map()
  if (articleIds.length === 0) return articles
  const { docs } = await payload.find({
    collection: 'articles',
    where: { id: { in: articleIds } },
    select: { title: true, keyword: true, status: true },
    depth: 0,
    pagination: false,
    user,
    overrideAccess: false,
  })
  for (const article of docs)
    articles.set(article.id, {
      title: article.title,
      keyword: article.keyword,
      status: article.status,
    })
  return articles
}
