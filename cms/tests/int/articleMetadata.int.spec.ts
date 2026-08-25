import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildArticleMetadata } from '@/lib/articleMetadata'
import { getMetadataBase, getSiteUrl } from '@/lib/siteUrl'
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

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSiteUrl', () => {
  it('prefers SITE_URL and strips a trailing slash', () => {
    vi.stubEnv('SITE_URL', 'https://example.com/')
    expect(getSiteUrl()).toBe('https://example.com')
    expect(getMetadataBase()?.origin).toBe('https://example.com')
  })

  it('falls back to localhost outside production when SITE_URL is unset', () => {
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(getSiteUrl()).toBe('http://localhost:3000')
  })

  it('returns undefined in production when SITE_URL is unset', () => {
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(getSiteUrl()).toBeUndefined()
    expect(getMetadataBase()).toBeUndefined()
  })
})

describe('buildArticleMetadata', () => {
  it('uses the public slug route as the canonical URL', () => {
    vi.stubEnv('SITE_URL', 'https://datum.example')
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
    vi.stubEnv('SITE_URL', 'https://datum.example')
    expect(buildArticleMetadata(article()).alternates).toEqual({ canonical: '/articles/42' })
  })

  it('omits canonical metadata in production when SITE_URL is unset', () => {
    vi.stubEnv('SITE_URL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(buildArticleMetadata(article({ slug: 'ops' })).alternates).toBeUndefined()
  })
})
