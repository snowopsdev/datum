import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { SetupChecklist } from './SetupChecklist'
import { loadSetupChecklistData } from './setupChecklistData'

/**
 * `/admin/ops/setup`. The same hub `/admin` shows before onboarding is
 * finished, kept reachable afterwards: a workspace's domain, audiences,
 * position, and evidence keep changing long after the first piece is written.
 */
export async function SetupView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const data = await loadSetupChecklistData(req.payload)

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
        <SetupChecklist {...data} />
      </Gutter>
    </DefaultTemplate>
  )
}
