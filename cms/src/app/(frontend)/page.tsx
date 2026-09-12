import { headers as getHeaders } from 'next/headers.js'
import Link from 'next/link'
import { getPayload } from 'payload'
import React from 'react'

import config from '@/payload.config'
import { modeFromEnv } from '@/lib/workspaceReadiness'
import { resolveWorkspaceProfile, type WorkspaceProfileDoc } from '@/lib/tenant/workspaceProfile'
import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })

  const [{ docs: published }, profileDoc] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { status: { equals: 'published' } },
      limit: 12,
      depth: 0,
      sort: '-publishedAt',
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true }),
  ])

  const profile = resolveWorkspaceProfile(profileDoc as WorkspaceProfileDoc, process.env, {
    mockDefault: modeFromEnv(process.env) === 'mock',
  })

  return (
    <div className="datum-home">
      <header className="datum-home__top">
        <div className="datum-home__logo">Datum</div>
        <nav className="datum-home__nav">
          {user ? (
            <a href={`${payloadConfig.routes.admin}/ops/content`}>Admin</a>
          ) : (
            <a href={`${payloadConfig.routes.admin}/login`}>Log in</a>
          )}
        </nav>
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
