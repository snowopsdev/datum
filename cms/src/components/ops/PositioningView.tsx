import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { positioningContentOf } from '../../lib/tenant/positioning'
import { PositioningEditor } from './PositioningEditor'

/** `/admin/ops/setup/positioning`. */
export async function PositioningView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const doc = await req.payload.findGlobal({
    slug: 'positioning',
    depth: 0,
    overrideAccess: true,
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
        <PositioningEditor initial={positioningContentOf(doc)} />
      </Gutter>
    </DefaultTemplate>
  )
}
