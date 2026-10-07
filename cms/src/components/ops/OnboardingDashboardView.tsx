import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { SetupChecklist } from './SetupChecklist'
import { loadSetupChecklistData } from './setupChecklistData'

/**
 * `/admin`. A workspace that has finished setup and has any content goes
 * straight to the list; otherwise the setup hub, which says what each of the
 * five assets holds right now. The same hub stays reachable at
 * `/admin/ops/setup` afterwards.
 */
export async function OnboardingDashboardView(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login')

  const [setup, pieces, suggestions] = await Promise.all([
    loadWorkspaceSetup(req.payload),
    req.payload.count({ collection: 'articles', where: { archived: { not_equals: true } } }),
    req.payload.count({ collection: 'setup-suggestions', where: { status: { equals: 'open' } } }),
  ])
  if (setup.readiness.governance.ready && pieces.totalDocs > 0 && suggestions.totalDocs === 0)
    redirect('/admin/ops/content')

  const data = await loadSetupChecklistData(req.payload, setup)

  return (
    <Gutter>
      {suggestions.totalDocs ? (
        <p>
          <span className="datum-ops__pill">{suggestions.totalDocs} setup suggestions</span>
        </p>
      ) : null}
      <SetupChecklist {...data} />
    </Gutter>
  )
}
