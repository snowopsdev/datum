import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { modeFromEnv } from '../../lib/workspaceReadiness'
import { loadContentPage } from './contentListData'
import { latestRunAction } from './boardActions'
import { ContentList } from './ContentList'

export async function ContentListView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const [content, latestRun] = await Promise.all([
    loadContentPage(req, searchParams as Record<string, string | string[] | undefined>),
    latestRunAction().catch(() => null),
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
        <ContentList content={content} latestRun={latestRun} mode={modeFromEnv(process.env)} />
      </Gutter>
    </DefaultTemplate>
  )
}
