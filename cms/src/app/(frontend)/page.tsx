import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { formatArticleDate } from '@/lib/articleReader'
import { modeFromEnv } from '@/lib/workspaceReadiness'
import { resolveWorkspaceProfile, type WorkspaceProfileDoc } from '@/lib/tenant/workspaceProfile'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const [{ docs: published }, profileDoc, { user }] = await Promise.all([
    payload.find({
      collection: 'articles',
      select: {
        title: true,
        keyword: true,
        slug: true,
        metaDescription: true,
        publishedAt: true,
      },
      where: { status: { equals: 'published' } },
      limit: 12,
      depth: 0,
      sort: '-publishedAt',
      overrideAccess: true,
    }),
    payload.findGlobal({
      slug: 'workspace-profile',
      select: { sitePages: false },
      depth: 0,
      overrideAccess: true,
    }),
    payload.auth({ headers }),
  ])

  const profile = resolveWorkspaceProfile(profileDoc as WorkspaceProfileDoc, process.env, {
    mockDefault: modeFromEnv(process.env) === 'mock',
  })

  return (
    <div className="datum-home">
      <header className="datum-home__top">
        <div className="datum-home__logo">Datum</div>
        {/* Readers get no sign-in link; editors go straight to /admin. */}
        {user ? (
          <nav className="datum-home__nav">
            <a href={`${payloadConfig.routes.admin}/ops/content`}>Admin</a>
          </nav>
        ) : null}
      </header>
      <main className="datum-home__main">
        <h1>Published articles</h1>
        {/* No lede without a company name: the fallback repeated the heading
            word for word, which reads as a rendering bug rather than a
            subtitle. An unnamed workspace gets the heading alone. */}
        {profile.companyName ? (
          <p className="datum-home__lede">Articles from {profile.companyName}</p>
        ) : null}
        {published.length === 0 ? (
          <p className="datum-home__empty">No published articles yet.</p>
        ) : (
          <ul className="datum-home__list">
            {published.map((a) => {
              const date = formatArticleDate(a.publishedAt)
              return (
                <li key={a.id}>
                  <Link href={`/articles/${a.slug || a.id}`}>
                    <span className="datum-home__item-title">{a.title || a.keyword}</span>
                    {a.metaDescription ? (
                      <span className="datum-home__item-dek">{a.metaDescription}</span>
                    ) : null}
                    {date ? (
                      <time className="datum-home__item-date" dateTime={a.publishedAt ?? undefined}>
                        {date}
                      </time>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
