import { describe, expect, it } from 'vitest'

import { buildArticleMetadata } from '@/lib/articleMetadata'
import type { Article } from '@/payload-types'

function article(overrides: Partial<Article> = {}): Article {
  return {
    id: 42,
    keyword: 'content operations',
    status: 'published',
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildArticleMetadata', () => {
  it('uses the public slug route as the canonical URL', () => {
    const metadata = buildArticleMetadata(
      article({
        slug: 'content-operations-guide',
        title: 'Content Operations Guide',
        titleTag: 'A Better Content Operations Guide',
        metaDescription: 'Build a reliable content operation.',
      }),
    )

    expect(metadata).toMatchObject({
      title: 'A Better Content Operations Guide',
      description: 'Build a reliable content operation.',
      alternates: { canonical: '/articles/content-operations-guide' },
    })
  })

  it('uses the public ID fallback when an article has no slug', () => {
    expect(buildArticleMetadata(article()).alternates).toEqual({ canonical: '/articles/42' })
  })
})
