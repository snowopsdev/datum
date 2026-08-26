import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { OnboardingHub } from './OnboardingHub'

export async function OnboardingDashboardView(props: AdminViewServerProps) {
  const { initPageResult } = props
  const { req } = initPageResult
  if (!req.user) redirect('/admin/login')
  const setup = await loadWorkspaceSetup(req.payload)

  return (
    <Gutter>
      <OnboardingHub setup={setup} />
    </Gutter>
  )
}
