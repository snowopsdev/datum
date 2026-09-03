import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import {
  resolveWorkspaceProfile,
  workspaceProfileProblems,
  type WorkspaceProfileDoc,
} from '../../lib/tenant/workspaceProfile'
import { modeFromEnv } from '../../lib/workspaceReadiness'
import { formatAuditTimestamp } from './articleStatus'
import { SetupWorkspaceEditor } from './SetupWorkspaceEditor'

/**
 * `/admin/ops/setup/workspace`.
 *
 * The form shows what is *saved*, not what is resolved: an operator editing
 * the domain has to see their own empty field, or they would delete an env var
 * they cannot see and wonder why nothing changed. The resolved fallback is
 * shown as a hint instead, and the problems come from the resolved profile,
 * which is what a run will actually use.
 */
export async function SetupWorkspaceView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const doc = (await req.payload.findGlobal({
    slug: 'workspace-profile',
    depth: 0,
    overrideAccess: true,
  })) as WorkspaceProfileDoc
  const resolved = resolveWorkspaceProfile(doc, process.env, {
    mockDefault: modeFromEnv(process.env) === 'mock',
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
        <SetupWorkspaceEditor
          companyName={doc.companyName ?? ''}
          targetDomain={doc.targetDomain ?? ''}
          siteNotes={doc.siteNotes ?? ''}
          competitors={(doc.competitors ?? []).flatMap((row) =>
            row ? [{ domain: row.domain ?? '', name: row.name ?? '' }] : [],
          )}
          sitePages={resolved.sitePages}
          sitePagesFetchedLabel={
            doc.sitePagesFetchedAt ? formatAuditTimestamp(doc.sitePagesFetchedAt) : null
          }
          fallbackDomain={resolved.targetDomain}
          fallbackSource={resolved.source.targetDomain}
          problems={workspaceProfileProblems(resolved)}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
