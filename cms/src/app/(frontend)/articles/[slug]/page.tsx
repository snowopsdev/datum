import config from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import type { Article } from '@/payload-types'
import { lexicalBodyToHtml } from '@/lib/lexicalHtml'
import '../styles.css'
import './article.css'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'articles',
    where: {
      and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const article = docs[0] as Article | undefined
  if (!article) return { title: 'Not found' }
  return {
    title: article.titleTag || article.title || article.keyword,
    description: article.metaDescription || undefined,
    openGraph: {
      title: article.ogTitle || article.titleTag || article.title || undefined,
      description: article.ogDescription || article.metaDescription || undefined,
      images: article.ogImage ? [article.ogImage] : undefined,
    },
  }
}

export default async function PublishedArticlePage({ params }: Props) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'articles',
    where: {
      and: [{ slug: { equals: slug } }, { status: { equals: 'published' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const article = docs[0] as Article | undefined
  if (!article) notFound()

  const html = lexicalBodyToHtml(article.body)
  const faq = article.faqItems ?? []

  return (
    <div className="datum-public">
      <header className="datum-public__top">
        <a className="datum-public__logo" href="/">
          Datum
        </a>
      </header>
      <article className="datum-public__article">
        <h1>{article.title || article.keyword}</h1>
        {article.metaDescription ? <p className="datum-public__dek">{article.metaDescription}</p> : null}
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
