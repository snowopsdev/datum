import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { lexicalToPlainText } from '../../lib/lexicalHtml'
import type { Template } from '../../payload-types'
import { TemplateConfigEditor } from './TemplateConfigEditor'
import type { TemplateConfigDTO } from './templateTypes'

function toDTO(doc: Template): TemplateConfigDTO {
  return {
    id: doc.id,
    name: doc.name,
    outline: lexicalToPlainText(doc.outline),
    example: lexicalToPlainText(doc.example),
    dos: (doc.dos ?? []).map((d) => d.text),
    donts: (doc.donts ?? []).map((d) => d.text),
    requiredSections: (doc.requiredSections ?? []).map((s) => s.heading),
    seoSpec: {
      titleTagMaxLength: doc.seoSpec?.titleTagMaxLength ?? null,
      metaDescriptionMaxLength: doc.seoSpec?.metaDescriptionMaxLength ?? null,
      headingStructureRules: doc.seoSpec?.headingStructureRules ?? '',
      faqRequired: doc.seoSpec?.faqRequired === true,
      faqMinQuestions: doc.seoSpec?.faqMinQuestions ?? null,
      faqMaxQuestions: doc.seoSpec?.faqMaxQuestions ?? null,
      ogTagsRequired: doc.seoSpec?.ogTagsRequired === true,
    },
    editHref: `/admin/collections/templates/${doc.id}`,
  }
}

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

  const templates = (docs as Template[]).map(toDTO)
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
