import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Template } from '../../payload-types'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { NewContentFlow, type TemplateCard } from './NewContentFlow'

export async function NewContentView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const [{ docs }, setup] = await Promise.all([
    req.payload.find({
      collection: 'templates',
      depth: 0,
      limit: 50,
      pagination: false,
      sort: 'name',
      user: req.user,
      overrideAccess: false,
    }),
    loadWorkspaceSetup(req.payload),
  ])

  const templates: TemplateCard[] = (docs as Template[]).map((t) => ({
    id: t.id,
    name: t.name,
    intent: t.intent ?? null,
    requiredSections: t.requiredSections?.length ?? 0,
  }))
  const r = setup.readiness

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
        <NewContentFlow
          mode={r.mode}
          pipelineReady={r.runtime.ready && r.governance.ready && r.content.ready}
          runActive={setup.latestRun?.status === 'queued' || setup.latestRun?.status === 'running'}
          templates={templates}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
