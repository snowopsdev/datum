import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { icpContentOf } from '../../lib/tenant/icp'
import type { Icp } from '../../payload-types'
import { formatAuditTimestamp } from './articleStatus'
import { IcpEditor } from './IcpEditor'
import type { IcpDTO } from './icpTypes'

/**
 * `/admin/ops/setup/audiences/:id`, and `/admin/ops/setup/audiences/new` for
 * one that does not exist yet.
 *
 * A new audience is not created until its first save: an operator who opens
 * the form and changes their mind should not leave an empty draft behind for
 * somebody else to tidy up.
 */
export async function IcpEditorView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const segments = Array.isArray(params?.segments) ? params.segments : []
  const idSegment = segments[3]
  if (!idSegment || Array.isArray(idSegment)) notFound()

  let record: IcpDTO | null = null
  if (idSegment !== 'new') {
    const id = Number(idSegment)
    if (!Number.isFinite(id)) notFound()
    let doc: Icp
    try {
      doc = (await req.payload.findByID({
        collection: 'icps',
        id,
        depth: 0,
        user: req.user,
        overrideAccess: false,
      })) as Icp
    } catch {
      notFound()
    }
    record = {
      ...icpContentOf(doc),
      id: doc.id,
      updatedAt: doc.updatedAt,
      updatedAtLabel: formatAuditTimestamp(doc.updatedAt),
      editHref: `/admin/collections/icps/${doc.id}`,
    }
  }

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
        <IcpEditor record={record} />
      </Gutter>
    </DefaultTemplate>
  )
}
