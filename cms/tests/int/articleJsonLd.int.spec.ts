import { describe, expect, it } from 'vitest'

import { buildArticleJsonLd, serializeJsonLd } from '@/lib/articleJsonLd'
import { articleDateline, faqAnchorId, readingMinutes } from '@/lib/articleReader'
import type { PublishedArticle } from '@/lib/findPublishedArticle'

function article(overrides: Partial<PublishedArticle> = {}): PublishedArticle {
  return {
    id: 7,
    slug: 'content-ops',
    title: 'Content Ops',
    keyword: 'content ops',
    metaDescription: 'How content ops works.',
    publishedAt: '2026-10-20T10:00:00.000Z',
    updatedAt: '2026-10-20T10:00:00.000Z',
    ...overrides,
  }
}

function byType(nodes: Record<string, unknown>[], type: string) {
  return nodes.find((n) => n['@type'] === type)
}

describe('buildArticleJsonLd', () => {
  it('emits Article and BreadcrumbList with absolute URLs when a site URL is given', () => {
    const nodes = buildArticleJsonLd(article({ ogImage: 'https://cdn.example/og.png' }), {
      siteUrl: 'https://datum.example/',
      publisherName: 'Acme',
    })

    expect(nodes.map((n) => n['@type'])).toEqual(['Article', 'BreadcrumbList'])
    expect(nodes.every((n) => n['@context'] === 'https://schema.org')).toBe(true)
    expect(byType(nodes, 'Article')).toMatchObject({
      headline: 'Content Ops',
      description: 'How content ops works.',
      datePublished: '2026-10-20T10:00:00.000Z',
      dateModified: '2026-10-20T10:00:00.000Z',
      image: 'https://cdn.example/og.png',
      mainEntityOfPage: 'https://datum.example/articles/content-ops',
      publisher: { '@type': 'Organization', name: 'Acme' },
      author: { '@type': 'Organization', name: 'Acme' },
    })
    expect(byType(nodes, 'BreadcrumbList')).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Home', item: 'https://datum.example/' },
        { position: 2, name: 'Content Ops', item: 'https://datum.example/articles/content-ops' },
      ],
    })
  })

  it('adds FAQPage only when the article has FAQ items', () => {
    expect(byType(buildArticleJsonLd(article()), 'FAQPage')).toBeUndefined()
    expect(byType(buildArticleJsonLd(article({ faqItems: [] })), 'FAQPage')).toBeUndefined()

    const faq = byType(
      buildArticleJsonLd(article({ faqItems: [{ question: 'Why?', answer: 'Because.' }] })),
      'FAQPage',
    )
    expect(faq).toMatchObject({
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Why?',
          acceptedAnswer: { '@type': 'Answer', text: 'Because.' },
        },
      ],
    })
  })

  it('emits no URLs without a site URL and invents no author or relative image', () => {
    const nodes = buildArticleJsonLd(article({ ogImage: '/relative.png' }))
    // schema.org's own @context is the only URL allowed.
    const json = JSON.stringify(nodes).replaceAll('https://schema.org', '')

    expect(json).not.toMatch(/https?:\/\//)
    expect(json).not.toContain('localhost')
    expect(json).not.toContain('"item"')
    expect(byType(nodes, 'Article')).not.toHaveProperty('mainEntityOfPage')
    expect(byType(nodes, 'Article')).not.toHaveProperty('image')
    expect(byType(nodes, 'Article')).not.toHaveProperty('author')
    expect(byType(nodes, 'Article')).not.toHaveProperty('publisher')
  })

  it('falls back to the keyword and the id route when title and slug are missing', () => {
    const nodes = buildArticleJsonLd(article({ title: null, slug: null }), {
      siteUrl: 'https://datum.example',
    })
    expect(byType(nodes, 'Article')).toMatchObject({
      headline: 'content ops',
      mainEntityOfPage: 'https://datum.example/articles/7',
    })
  })
})

describe('serializeJsonLd', () => {
  it('cannot be closed early by a </script> in generated text', () => {
    const nodes = buildArticleJsonLd(
      article({ title: 'Evil </script><script>alert(1)</script>', metaDescription: '<!-- x' }),
    )
    const serialized = serializeJsonLd(nodes[0])

    expect(serialized).not.toContain('<')
    expect(JSON.parse(serialized).headline).toBe('Evil </script><script>alert(1)</script>')
  })
})

describe('article reader helpers', () => {
  it('estimates reading time at 200 words a minute, minimum one', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('word '.repeat(200))).toBe(1)
    expect(readingMinutes('word '.repeat(201))).toBe(2)
    expect(readingMinutes('word '.repeat(800))).toBe(4)
  })

  it('builds the dateline, showing Updated only for a material later edit', () => {
    expect(
      articleDateline({
        publishedAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-10-20T11:00:00.000Z',
        minutes: 4,
      }),
    ).toEqual(['Oct 20, 2026', '4 min read'])
    expect(
      articleDateline({
        publishedAt: '2026-10-20T10:00:00.000Z',
        updatedAt: '2026-11-02T09:00:00.000Z',
        minutes: 4,
      }).join(' · '),
    ).toBe('Oct 20, 2026 · 4 min read · Updated Nov 2, 2026')
    expect(articleDateline({ minutes: 2 })).toEqual(['2 min read'])
  })

  it('makes unique, URL-safe FAQ anchors', () => {
    expect(faqAnchorId('What is SEO?', 0)).toBe('faq-1-what-is-seo')
    expect(faqAnchorId('What is SEO?', 1)).toBe('faq-2-what-is-seo')
    expect(faqAnchorId('???', 2)).toBe('faq-3')
  })
})
