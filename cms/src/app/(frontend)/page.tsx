import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const { docs: published } = await payload.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    limit: 12,
    depth: 0,
    sort: '-publishedAt',
    overrideAccess: true,
  })

  return (
    <div className="datum-home">
      <header className="datum-home__top">
        <div className="datum-home__logo">Datum</div>
        <nav className="datum-home__nav">
          {user ? (
            <>
              <a href={payloadConfig.routes.admin}>Admin</a>
              <Link href="/admin/ops/articles">Article board</Link>
            </>
          ) : (
            <a href={`${payloadConfig.routes.admin}/login`}>Log in</a>
          )}
        </nav>
      </header>
      <main className="datum-home__main">
        <h1>Published articles</h1>
        <p className="datum-home__lede">
          Minimal public reader — long-scroll articles from the content pipeline.
        </p>
        {published.length === 0 ? (
          <p className="datum-home__empty">No published articles yet.</p>
        ) : (
          <ul className="datum-home__list">
            {published.map((a) => (
              <li key={a.id}>
                <Link href={`/articles/${a.slug || a.id}`}>{a.title || a.keyword}</Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
