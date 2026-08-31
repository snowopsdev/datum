import config from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { buildArticleMetadata } from '@/lib/articleMetadata'
import { findPublishedArticle } from '@/lib/findPublishedArticle'
import { lexicalBodyToHtml } from '@/lib/lexicalHtml'
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

  const html = lexicalBodyToHtml(article.body)
  const faq = article.faqItems ?? []

  return (
    <div className="datum-public">
      <header className="datum-public__top">
        <Link className="datum-public__logo" href="/">
          Datum
        </Link>
      </header>
      <article className="datum-public__article">
        <h1>{article.title || article.keyword}</h1>
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
            <h2>FAQ</h2>
            {faq.map((item) => (
              <div className="datum-public__faq-item" key={item.id ?? item.question}>
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
            ))}
          </section>
        ) : null}
      </article>
    </div>
  )
}
