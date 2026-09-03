import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { icpAudienceLine, icpContentOf } from '../../lib/tenant/icp'
import type { Icp } from '../../payload-types'
import { formatAuditTimestamp } from './articleStatus'
import type { IcpListRow } from './icpTypes'
import './ops.css'

/**
 * `/admin/ops/setup/audiences`. Every audience, whatever its status: an
 * archived one is part of why an old article says what it says, so it is
 * listed rather than hidden.
 */
export async function IcpListView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const { docs } = await req.payload.find({
    collection: 'icps',
    depth: 0,
    limit: 200,
    pagination: false,
    sort: ['-primary', 'status', 'name'],
    user: req.user,
    overrideAccess: false,
  })

  const rows: IcpListRow[] = (docs as Icp[]).map((doc) => {
    const content = icpContentOf(doc)
    return {
      id: doc.id,
      name: content.name || 'Untitled audience',
      status: content.status,
      primary: content.primary,
      updatedAtLabel: formatAuditTimestamp(doc.updatedAt),
      audienceLine: icpAudienceLine(content),
    }
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
        <div className="datum-ops">
          <div className="datum-ops__header">
            <h1>Audiences</h1>
            <span className="datum-ops__pill">setup</span>
            <Link className="datum-ops__link-btn" href="/admin/ops/setup" prefetch={false}>
              ← Setup
            </Link>
          </div>
          <p className="datum-ops__lede">
            Who each piece is written for. The primary audience is what a new piece starts with; the
            brief can change it per piece. An audience governs prompts only once it is active.
          </p>

          <div className="datum-ops__actions">
            <Link
              className="datum-ops__btn datum-ops__btn--primary"
              href="/admin/ops/setup/audiences/new"
              prefetch={false}
            >
              New audience
            </Link>
          </div>

          {rows.length === 0 ? (
            <p className="datum-ops__empty">
              No audiences yet. A run needs at least one active audience before it can write.
            </p>
          ) : (
            <table className="datum-ops__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Primary</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/ops/setup/audiences/${row.id}`} prefetch={false}>
                        {row.name}
                      </Link>
                      {row.audienceLine ? (
                        <p className="datum-ops__hint">{row.audienceLine}</p>
                      ) : null}
                    </td>
                    <td>
                      <span className={`datum-ops__status datum-ops__status--${row.status}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>{row.primary ? 'Yes' : ''}</td>
                    <td>{row.updatedAtLabel}</td>
                    <td>
                      <Link
                        className="datum-ops__link-btn"
                        href={`/admin/ops/setup/audiences/${row.id}`}
                        prefetch={false}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}
