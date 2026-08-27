import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Article } from '../../payload-types'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { toBoardArticle } from './articleStatus'
import { latestRunAction } from './boardActions'
import { ContentList } from './ContentList'

export async function ContentListView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const [{ docs }, setup, latestRun] = await Promise.all([
    req.payload.find({
      collection: 'articles',
      depth: 1,
      limit: 500,
      pagination: false,
      sort: '-updatedAt',
      user: req.user,
      overrideAccess: false,
      // Archived pieces are off the list by definition; `runPipeline` skips
      // them for the same reason, so the two views of "live work" agree.
      where: { archived: { not_equals: true } },
    }),
    loadWorkspaceSetup(req.payload),
    latestRunAction(),
  ])

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
        <ContentList
          articles={(docs as Article[]).map(toBoardArticle)}
          latestRun={latestRun}
          mode={setup.readiness.mode}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
