import config from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { EditorBar } from '@/components/public/EditorBar'
import { buildArticleJsonLd, serializeJsonLd } from '@/lib/articleJsonLd'
import { buildArticleMetadata } from '@/lib/articleMetadata'
import { articleDateline, faqAnchorId, readingMinutes } from '@/lib/articleReader'
import { findPublishedArticle } from '@/lib/findPublishedArticle'
import { lastH2HeadingText, lexicalBodyToHtml, lexicalToPlainText } from '@/lib/lexicalHtml'
import { getConfiguredSiteUrl } from '@/lib/siteUrl'
import './article.css'

type Props = {
  params: Promise<{ slug: string }>
}

// ISR: readers get a cached page instead of a Postgres query per request.
// Publishing purges immediately via `revalidatePublishedArticle`; the interval
// only bounds staleness for edits made to an already-published article.
export const revalidate = 300

// Empty on purpose: build machines have no database, so nothing prerenders at
// build time. Without this export the segment stays fully dynamic and
// `revalidate` never applies; with it, each article renders on first request
// and is then served from cache.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return []
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const article = await findPublishedArticle(payload, slug)
  if (!article) return { title: 'Not found' }
  return buildArticleMetadata(article)
}

export default async function PublishedArticlePage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const article = await findPublishedArticle(payload, slug)
  if (!article) notFound()

  const profile = await payload.findGlobal({
    slug: 'workspace-profile',
    select: { companyName: true },
    depth: 0,
    overrideAccess: true,
  })
  const jsonLd = buildArticleJsonLd(article, {
    siteUrl: getConfiguredSiteUrl(),
    publisherName: profile.companyName?.trim() || undefined,
  })
  const dateline = articleDateline({
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    minutes: readingMinutes(lexicalToPlainText(article.body)),
  })

  const html = lexicalBodyToHtml(article.body)
  const faq = article.faqItems ?? []
  // The template's outline can already end with its own "FAQ" heading; render
  // the items directly under it instead of adding a second one that repeats it.
  const bodyEndsWithFaqHeading = (lastH2HeadingText(article.body) ?? '').toLowerCase() === 'faq'

  return (
    <div className="datum-public">
      <header className="datum-public__top">
        <Link className="datum-public__logo" href="/">
          Datum
        </Link>
        <Link className="datum-public__all" href="/">
          All articles
        </Link>
      </header>
      {jsonLd.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
      <article className="datum-public__article">
        <h1>{article.title || article.keyword}</h1>
        <p className="datum-public__dateline">{dateline.join(' · ')}</p>
        {article.metaDescription ? (
          <p className="datum-public__dek">{article.metaDescription}</p>
        ) : null}
        {html ? (
          <div className="datum-public__body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p className="datum-public__dek">This article has no body yet.</p>
        )}
        {faq.length > 0 ? (
          <section className="datum-public__faq">
            {bodyEndsWithFaqHeading ? null : <h2>FAQ</h2>}
            {faq.map((item, i) => (
              <div className="datum-public__faq-item" key={item.id ?? item.question}>
                <h3 id={faqAnchorId(item.question, i)}>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </section>
        ) : null}
      </article>
      <EditorBar articleId={article.id} />
    </div>
  )
}
