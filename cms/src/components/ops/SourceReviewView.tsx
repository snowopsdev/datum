import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { SourceReviewQueue } from './SourceReviewQueue'
import { toCandidateDTO, type ArticleLookup } from './sourceReviewTypes'

/** Cards past this are not work anybody is going to get through in one sitting. */
const CANDIDATE_LIMIT = 200

export async function SourceReviewView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const { docs: candidateDocs } = await req.payload.find({
    collection: 'evidence-source-candidates',
    depth: 0,
    limit: CANDIDATE_LIMIT,
    sort: '-lastSeenAt',
    user: req.user,
    overrideAccess: false,
  })

  // Every rule, not just the active ones: `matchEvidenceRule` needs to see an
  // inactive row as *not* covering, and a card links to the rule it matched.
  const { docs: ruleDocs } = await req.payload.find({
    collection: 'evidence-sources',
    depth: 0,
    pagination: false,
    user: req.user,
    overrideAccess: false,
  })

  // One lookup for every article named in a sighting, so a card can say which
  // article is waiting on this domain rather than just showing an id.
  const articleIds = [
    ...new Set(
      candidateDocs.flatMap((doc) =>
        Array.isArray(doc.sightings)
          ? doc.sightings
              .map((s) => (s && typeof s === 'object' ? (s as { articleId?: unknown }).articleId : null))
              .filter((id): id is number => typeof id === 'number')
          : [],
      ),
    ),
  ]
  const articles: ArticleLookup = new Map()
  if (articleIds.length > 0) {
    const { docs: articleDocs } = await req.payload.find({
      collection: 'articles',
      where: { id: { in: articleIds } },
      depth: 0,
      pagination: false,
      user: req.user,
      overrideAccess: false,
    })
    for (const article of articleDocs) {
      articles.set(article.id, {
        title: article.title,
        keyword: article.keyword,
        status: article.status,
      })
    }
  }

  const candidates = candidateDocs.map((doc) => toCandidateDTO(doc, ruleDocs, articles))

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams as Record<string, string | string[] | undefined>}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <SourceReviewQueue candidates={candidates} />
      </Gutter>
    </DefaultTemplate>
  )
}
