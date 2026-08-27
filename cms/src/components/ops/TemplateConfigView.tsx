import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Template } from '../../payload-types'
import { TemplateConfigEditor } from './TemplateConfigEditor'
import { toTemplateDTO } from './templateTypes'

export async function TemplateConfigView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const { docs } = await req.payload.find({
    collection: 'templates',
    depth: 0,
    limit: 50,
    pagination: false,
    sort: 'name',
    user: req.user,
    overrideAccess: false,
  })

  const templates = (docs as Template[]).map(toTemplateDTO)
  const rawId = searchParams?.id
  const idStr = Array.isArray(rawId) ? rawId[0] : rawId
  const initialId = idStr && Number.isFinite(Number(idStr)) ? Number(idStr) : null

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
        <TemplateConfigEditor templates={templates} initialId={initialId} />
      </Gutter>
    </DefaultTemplate>
  )
}
