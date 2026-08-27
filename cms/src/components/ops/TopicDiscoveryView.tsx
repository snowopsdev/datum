import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { TopicDiscoveryPage } from './TopicDiscoveryPage'

/** What a run genuinely requires, which is less than full onboarding. */
const canStartRun = (readiness: { runtime: { ready: boolean }; governance: { ready: boolean }; content: { ready: boolean } }) =>
  readiness.runtime.ready && readiness.governance.ready && readiness.content.ready

export async function TopicDiscoveryView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const setup = await loadWorkspaceSetup(req.payload)
  const waiting = await req.payload.count({
    collection: 'articles',
    // Must match the board's own filter, or this page advertises topics that
    // are not there — an archived topic is waiting for nothing.
    where: { and: [{ status: { equals: 'topic_selected' } }, { archived: { not_equals: true } }] },
  })

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
        <TopicDiscoveryPage
          mode={setup.readiness.mode}
          pipelineReady={canStartRun(setup.readiness)}
          runActive={setup.latestRun?.status === 'queued' || setup.latestRun?.status === 'running'}
          templates={setup.templates as Array<{ id: number; name: string }>}
          waitingCount={waiting.totalDocs}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
