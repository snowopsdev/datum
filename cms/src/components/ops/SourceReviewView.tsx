import { loadSourceReviewArticles } from './sourceReviewData'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { SourceReviewQueue } from './SourceReviewQueue'
import { toCandidateDTO } from './sourceReviewTypes'

/** Cards past this are not work anybody is going to get through in one sitting. */
const CANDIDATE_LIMIT = 200

export async function SourceReviewView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const [{ docs: candidateDocs }, { docs: ruleDocs }] = await Promise.all([
    req.payload.find({
      collection: 'evidence-source-candidates',
      depth: 0,
      limit: CANDIDATE_LIMIT,
      sort: '-lastSeenAt',
      user: req.user,
      overrideAccess: false,
    }),
    // Include inactive rules: a card must know when a rule no longer covers it.
    req.payload.find({
      collection: 'evidence-sources',
      depth: 0,
      pagination: false,
      user: req.user,
      overrideAccess: false,
    }),
  ])

  // One lookup for every article named in a sighting, so a card can say which
  // article is waiting on this domain rather than just showing an id.
  const articleIds = [
    ...new Set(
      candidateDocs.flatMap((doc) =>
        Array.isArray(doc.sightings)
          ? doc.sightings
              .map((s) =>
                s && typeof s === 'object' ? (s as { articleId?: unknown }).articleId : null,
              )
              .filter((id): id is number => typeof id === 'number')
          : [],
      ),
    ),
  ]
  const articles = await loadSourceReviewArticles(req.payload, req.user, articleIds)

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
