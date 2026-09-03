import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { evidenceBankContentOf } from '../../lib/tenant/evidenceBank'
import { EvidenceBankEditor } from './EvidenceBankEditor'
import { emptyEvidenceBankDraft } from './setupTypes'

/**
 * `/admin/ops/setup/evidence`.
 *
 * `today` is resolved on the server and passed down so the expiry filter and
 * the readiness counts agree about which day it is, whatever timezone the
 * browser is in.
 */
export async function EvidenceBankView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) redirect('/admin/login')

  const doc = await req.payload.findGlobal({
    slug: 'evidence-bank',
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
        <EvidenceBankEditor
          initial={emptyEvidenceBankDraft(evidenceBankContentOf(doc))}
          today={new Date().toISOString().slice(0, 10)}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
