import { cache } from 'react'
import type { Payload, Where } from 'payload'

import type { Article } from '@/payload-types'

export type PublishedArticle = Pick<
  Article,
  | 'id'
  | 'slug'
  | 'title'
  | 'keyword'
  | 'body'
  | 'faqItems'
  | 'titleTag'
  | 'metaDescription'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogImage'
>

const publicFields = {
  slug: true,
  title: true,
  keyword: true,
  body: true,
  faqItems: true,
  titleTag: true,
  metaDescription: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
} as const

/** Resolve a published article by slug, or by numeric id when the path is an ID fallback. */
export const findPublishedArticle = cache(async function findPublishedArticle(
  payload: Payload,
  slugOrId: string,
): Promise<PublishedArticle | null> {
  const bySlug = await payload.find({
    collection: 'articles',
    select: publicFields,
    where: {
      and: [{ slug: { equals: slugOrId } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (bySlug.docs[0]) return bySlug.docs[0] as PublishedArticle

  if (/^\d+$/.test(slugOrId)) {
    const id = Number(slugOrId)
    const where: Where = {
      and: [{ id: { equals: id } }, { status: { equals: 'published' } }],
    }
    const byId = await payload.find({
      collection: 'articles',
      select: publicFields,
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (byId.docs[0]) return byId.docs[0] as PublishedArticle
  }

  return null
})
