import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { brandVoiceContentOf } from '../../lib/brandVoice'
import type { BrandVoice, GovernanceAudit } from '../../payload-types'
import { formatAuditTimestamp } from './articleStatus'
import { BrandVoiceEditor } from './BrandVoiceEditor'
import type { BrandVoiceAuditEntry, BrandVoiceDTO, BrandVoiceMode } from './brandVoiceTypes'

function toDTO(doc: BrandVoice): BrandVoiceDTO {
  const file = doc.sourceFile && typeof doc.sourceFile === 'object' ? doc.sourceFile : null
  return {
    ...brandVoiceContentOf(doc),
    id: doc.id,
    status: doc.status,
    source: doc.source,
    onboardingStep: doc.onboardingStep ?? 0,
    activatedAt: doc.activatedAt ?? null,
    activatedBy: doc.activatedBy ?? null,
    sourceFile:
      file && file.url ? { id: file.id, filename: file.filename ?? 'guide', url: file.url } : null,
    updatedAt: doc.updatedAt,
    editHref: `/admin/collections/brand-voices/${doc.id}`,
  }
}

function toAuditEntry(entry: GovernanceAudit): BrandVoiceAuditEntry {
  return {
    id: `gov-${entry.id}`,
    actor: entry.actor,
    actorType: entry.actorType,
    createdAt: entry.createdAt,
    createdAtLabel: formatAuditTimestamp(entry.createdAt),
    details: entry.details,
    event: entry.event,
    fromStatus: entry.fromStatus ?? null,
    pipelineRunId: null,
    stage: null,
    summary: entry.summary,
    toStatus: entry.toStatus ?? null,
  }
}

const MODES: BrandVoiceMode[] = ['onboarding', 'review', 'guide']

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function BrandVoiceView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const { docs } = await req.payload.find({
    collection: 'brand-voices',
    depth: 1,
    limit: 20,
    sort: '-updatedAt',
    user: req.user,
    overrideAccess: false,
  })
  const records = (docs as BrandVoice[]).map(toDTO)

  const idStr = param(searchParams?.id)
  const requestedId = idStr && Number.isFinite(Number(idStr)) ? Number(idStr) : null
  const selected =
    records.find((r) => r.id === requestedId) ??
    records.find((r) => r.status === 'active') ??
    records.find((r) => r.status === 'draft') ??
    records[0] ??
    null

  let auditEntries: BrandVoiceAuditEntry[] = []
  if (selected) {
    const subjectFilter = (entry: GovernanceAudit) =>
      entry.subject?.relationTo === 'brand-voices' &&
      (typeof entry.subject.value === 'object' ? entry.subject.value.id : entry.subject.value) ===
        selected.id
    try {
      const { docs: auditDocs } = await req.payload.find({
        collection: 'governance-audit',
        where: {
          and: [
            { 'subject.value': { equals: selected.id } },
            { 'subject.relationTo': { equals: 'brand-voices' } },
          ],
        },
        depth: 0,
        limit: 100,
        sort: '-createdAt',
        user: req.user,
        overrideAccess: false,
      })
      auditEntries = (auditDocs as GovernanceAudit[]).map(toAuditEntry)
    } catch {
      // Polymorphic where unsupported by the adapter — filter the recent log in code.
      const { docs: auditDocs } = await req.payload.find({
        collection: 'governance-audit',
        depth: 0,
        limit: 100,
        sort: '-createdAt',
        user: req.user,
        overrideAccess: false,
      })
      auditEntries = (auditDocs as GovernanceAudit[]).filter(subjectFilter).map(toAuditEntry)
    }
  }

  const modeStr = param(searchParams?.mode)
  const initialMode = MODES.includes(modeStr as BrandVoiceMode) ? (modeStr as BrandVoiceMode) : null

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
        <BrandVoiceEditor
          records={records}
          selectedId={selected?.id ?? null}
          auditEntries={auditEntries}
          initialMode={initialMode}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
