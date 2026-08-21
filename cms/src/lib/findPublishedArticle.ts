import type { Payload, Where } from 'payload'

import type { Article } from '@/payload-types'

/** Resolve a published article by slug, or by numeric id when the path is an ID fallback. */
export async function findPublishedArticle(
  payload: Payload,
  slugOrId: string,
): Promise<Article | null> {
  const bySlug = await payload.find({
    collection: 'articles',
    where: {
      and: [{ slug: { equals: slugOrId } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (bySlug.docs[0]) return bySlug.docs[0] as Article

  if (/^\d+$/.test(slugOrId)) {
    const id = Number(slugOrId)
    const where: Where = {
      and: [{ id: { equals: id } }, { status: { equals: 'published' } }],
    }
    const byId = await payload.find({
      collection: 'articles',
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (byId.docs[0]) return byId.docs[0] as Article
  }

  return null
}
