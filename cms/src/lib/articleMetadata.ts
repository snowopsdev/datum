import type { Metadata } from 'next'

import type { Article } from '@/payload-types'

export function buildArticleMetadata(article: Article): Metadata {
  const canonicalSegment = encodeURIComponent(article.slug || String(article.id))

  return {
    title: article.titleTag || article.title || article.keyword,
    description: article.metaDescription || undefined,
    alternates: {
      canonical: `/articles/${canonicalSegment}`,
    },
    openGraph: {
      title: article.ogTitle || article.titleTag || article.title || undefined,
      description: article.ogDescription || article.metaDescription || undefined,
      images: article.ogImage ? [article.ogImage] : undefined,
    },
  }
}
