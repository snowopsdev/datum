import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
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

  const [content, latestRun, suggestions] = await Promise.all([
    loadContentPage(req, searchParams as Record<string, string | string[] | undefined>),
    latestRunAction().catch(() => null),
    req.payload.count({
      collection: 'setup-suggestions',
      where: { status: { equals: 'open' } },
      overrideAccess: true,
    }),
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
        {/* A finished workspace lands here, not on the setup checklist, so this
            is where it hears that reviewers' corrections have suggestions. */}
        {suggestions.totalDocs > 0 ? (
          <p className="datum-ops__hint">
            <Link href="/admin/ops/setup#suggestions">
              {suggestions.totalDocs} setup suggestion{suggestions.totalDocs === 1 ? '' : 's'} from
              reviewers&rsquo; corrections
            </Link>
          </p>
        ) : null}
        <ContentList content={content} latestRun={latestRun} mode={modeFromEnv(process.env)} />
      </Gutter>
    </DefaultTemplate>
  )
}
