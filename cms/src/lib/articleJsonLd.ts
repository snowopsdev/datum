import type { PublishedArticle } from './findPublishedArticle'

type JsonLdNode = Record<string, unknown>

type Options = {
  /** Site origin, or undefined when none is configured — then no URL is emitted at all. */
  siteUrl?: string
  /** Workspace profile company name; there is deliberately no person author. */
  publisherName?: string
}

const SCHEMA = 'https://schema.org'

function isAbsoluteUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value)
}

/**
 * schema.org nodes for a published article: Article, FAQPage (only with FAQ
 * items) and BreadcrumbList. Pure and URL-free unless `siteUrl` is passed, so a
 * missing SITE_URL can never leak localhost into structured data.
 */
export function buildArticleJsonLd(article: PublishedArticle, opts: Options = {}): JsonLdNode[] {
  const headline = article.title || article.keyword
  const siteUrl = opts.siteUrl?.replace(/\/$/, '')
  const articleUrl = siteUrl
    ? `${siteUrl}/articles/${encodeURIComponent(article.slug || String(article.id))}`
    : undefined
  const organization = opts.publisherName
    ? { '@type': 'Organization', name: opts.publisherName }
    : undefined

  const nodes: JsonLdNode[] = [
    {
      '@context': SCHEMA,
      '@type': 'Article',
      headline,
      ...(article.metaDescription ? { description: article.metaDescription } : {}),
      ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
      ...(article.updatedAt ? { dateModified: article.updatedAt } : {}),
      ...(isAbsoluteUrl(article.ogImage) ? { image: article.ogImage } : {}),
      ...(articleUrl ? { mainEntityOfPage: articleUrl } : {}),
      ...(organization ? { publisher: organization, author: organization } : {}),
    },
  ]

  const faq = article.faqItems ?? []
  if (faq.length > 0) {
    nodes.push({
      '@context': SCHEMA,
      '@type': 'FAQPage',
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    })
  }

  nodes.push({
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        ...(siteUrl ? { item: `${siteUrl}/` } : {}),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: headline,
        ...(articleUrl ? { item: articleUrl } : {}),
      },
    ],
  })

  return nodes
}

/** Safe for an inline `<script type="application/ld+json">`: no raw `<` can close the tag. */
export function serializeJsonLd(node: JsonLdNode): string {
  return JSON.stringify(node).replace(/</g, '\\u003c')
}
