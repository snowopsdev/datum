'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { plainTextToLexical } from '../../lib/lexicalHtml'
import { type TemplateConfigDTO, toTemplateDTO } from './templateTypes'

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

/**
 * Start a new content template.
 *
 * Deliberately creates a usable-but-empty shell rather than asking for
 * everything up front: the outline, dos/donts and required H2s are the work,
 * and they belong in the editor's own tabs where there is room to explain them.
 * The SEO defaults match what the three seeded templates use, so a template
 * created here already passes structural QA's length checks without anyone
 * choosing a number they have no basis to choose.
 *
 * `requiredSections` is left empty on purpose. Every heading in it is enforced
 * against the draft, so a guessed default would fail QA on articles nobody had
 * a chance to configure for.
 */
export async function createTemplateAction(
  name: string,
): Promise<{ ok: true; template: TemplateConfigDTO } | { ok: false; error: string }> {
  try {
    const { payload, user } = await requireUser()
    const trimmed = name.trim()
    if (!trimmed) return { ok: false, error: 'Give the template a name.' }
    if (trimmed.length > 80) return { ok: false, error: 'Keep the name under 80 characters.' }

    const { totalDocs } = await payload.count({
      collection: 'templates',
      where: { name: { equals: trimmed } },
    })
    if (totalDocs > 0) {
      return { ok: false, error: `A template called "${trimmed}" already exists.` }
    }

    const created = await payload.create({
      collection: 'templates',
      user,
      overrideAccess: false,
      data: {
        name: trimmed,
        outline: plainTextToLexical(
          `Outline for ${trimmed}.\n\nDescribe the shape this content should take — the sections, the order, and what each one is for. This is guidance for the writer, not a checklist: the headings QA actually enforces live under Rules.`,
        ),
        example: plainTextToLexical(''),
        dos: [],
        donts: [],
        requiredSections: [],
        seoSpec: {
          titleTagMaxLength: 60,
          metaDescriptionMaxLength: 160,
          headingStructureRules: null,
          faqRequired: true,
          faqMinQuestions: 3,
          faqMaxQuestions: 6,
          ogTagsRequired: true,
        },
      },
    })

    revalidatePath('/admin/ops/templates')
    revalidatePath('/admin/ops/articles')
    revalidatePath('/admin/ops/topics')
    return { ok: true, template: toTemplateDTO(created) }
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Could not create that template.'
    return { ok: false, error: message }
  }
}
