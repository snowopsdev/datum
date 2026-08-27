import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { FirstRun } from './FirstRun'

/**
 * `/admin`. A workspace with a voice and any content goes straight to the
 * list; otherwise the first-run screen, which is one decision long.
 */
export async function OnboardingDashboardView(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login')

  const [setup, pieces] = await Promise.all([
    loadWorkspaceSetup(req.payload),
    req.payload.count({ collection: 'articles', where: { archived: { not_equals: true } } }),
  ])
  const hasVoice = setup.readiness.governance.ready
  if (hasVoice && pieces.totalDocs > 0) redirect('/admin/ops/content')

  return (
    <Gutter>
      <FirstRun hasVoice={hasVoice} mode={setup.readiness.mode} />
    </Gutter>
  )
}
