import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { icpContentOf } from '../../lib/tenant/icp'
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

  const id = idSegment === 'new' ? null : Number(idSegment)
  if (id !== null && !Number.isFinite(id)) notFound()
  const [profile, doc, otherActive] = await Promise.all([
    req.payload.findGlobal({
      slug: 'workspace-profile',
      select: { sitePagesFetchedAt: true },
      depth: 0,
      overrideAccess: true,
    }),
    id === null
      ? Promise.resolve(null)
      : req.payload
          .findByID({
            collection: 'icps',
            id,
            depth: 0,
            user: req.user,
            overrideAccess: false,
          })
          .catch(() => null),
    req.payload.count({
      collection: 'icps',
      where: {
        and: [
          { status: { equals: 'active' } },
          ...(id === null ? [] : [{ id: { not_equals: id } }]),
        ],
      },
      overrideAccess: true,
    }),
  ])
  if (id !== null && !doc) notFound()
  const record: IcpDTO | null = doc
    ? {
        ...icpContentOf(doc),
        id: doc.id,
        updatedAt: doc.updatedAt,
        updatedAtLabel: formatAuditTimestamp(doc.updatedAt),
        editHref: `/admin/collections/icps/${doc.id}`,
      }
    : null

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
        <IcpEditor
          record={record}
          sitePagesFetchedAt={
            (profile as { sitePagesFetchedAt?: string | null }).sitePagesFetchedAt ?? null
          }
          hasOtherActiveAudience={otherActive.totalDocs > 0}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
