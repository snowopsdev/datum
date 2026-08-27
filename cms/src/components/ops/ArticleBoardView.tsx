import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Article } from '../../payload-types'
import { ArticleBoard } from './ArticleBoard'
import { latestRunAction } from './boardActions'
import { toBoardArticle } from './articleStatus'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'

/** What a run genuinely requires, which is less than full onboarding. */
const canStartRun = (readiness: { runtime: { ready: boolean }; governance: { ready: boolean }; content: { ready: boolean } }) =>
  readiness.runtime.ready && readiness.governance.ready && readiness.content.ready

export async function ArticleBoardView(props: AdminViewServerProps) {
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
      // Archived topics are off the board by definition; `runPipeline` skips
      // them for the same reason, so the two views of "live work" agree.
      where: { archived: { not_equals: true } },
      user: req.user,
      overrideAccess: false,
    }),
    loadWorkspaceSetup(req.payload),
    latestRunAction(),
  ])

  const articles = (docs as Article[]).map(toBoardArticle)

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
        <ArticleBoard
          articles={articles}
          mode={setup.readiness.mode}
          latestRun={latestRun}
          pipelineReady={canStartRun(setup.readiness)}
          runActive={setup.latestRun?.status === 'queued' || setup.latestRun?.status === 'running'}
          templates={setup.templates as Array<{ id: number; name: string }>}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
