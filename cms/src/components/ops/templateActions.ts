'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { plainTextToLexical } from '../../lib/lexicalHtml'

export type TemplateConfigInput = {
  /** Only set when the Outline tab content changed — otherwise Lexical is left untouched. */
  outline?: string
  /** Only set when the Examples tab content changed — otherwise Lexical is left untouched. */
  example?: string
  dos: string[]
  donts: string[]
  requiredSections: string[]
  seoSpec: {
    titleTagMaxLength: number | null
    metaDescriptionMaxLength: number | null
    headingStructureRules: string
    faqRequired: boolean
    faqMinQuestions: number | null
    faqMaxQuestions: number | null
    ogTagsRequired: boolean
  }
}

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Unauthorized')
  return { payload, user }
}

export async function saveTemplateConfigAction(templateId: number, input: TemplateConfigInput) {
  const { payload, user } = await requireUser()
  const data: Record<string, unknown> = {
    dos: input.dos.filter((t) => t.trim()).map((text) => ({ text: text.trim() })),
    donts: input.donts.filter((t) => t.trim()).map((text) => ({ text: text.trim() })),
    requiredSections: input.requiredSections
      .filter((h) => h.trim())
      .map((heading) => ({ heading: heading.trim() })),
    seoSpec: {
      titleTagMaxLength: input.seoSpec.titleTagMaxLength,
      metaDescriptionMaxLength: input.seoSpec.metaDescriptionMaxLength,
      headingStructureRules: input.seoSpec.headingStructureRules || null,
      faqRequired: input.seoSpec.faqRequired,
      faqMinQuestions: input.seoSpec.faqMinQuestions,
      faqMaxQuestions: input.seoSpec.faqMaxQuestions,
      ogTagsRequired: input.seoSpec.ogTagsRequired,
    },
  }

  // Lossy plain↔Lexical conversion only runs when the operator edited those tabs.
  if (typeof input.outline === 'string') {
    data.outline = plainTextToLexical(input.outline)
  }
  if (typeof input.example === 'string') {
    data.example = plainTextToLexical(input.example)
  }

  await payload.update({
    collection: 'templates',
    id: templateId,
    data,
    user,
    overrideAccess: false,
  })
  revalidatePath('/admin/ops/templates')
  revalidatePath(`/admin/ops/templates/${templateId}`)
}
