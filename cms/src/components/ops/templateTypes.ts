import { lexicalToPlainText } from '../../lib/lexicalHtml'
import type { Template } from '../../payload-types'

export type TemplateConfigDTO = {
  id: number
  name: string
  outline: string
  example: string
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
  editHref: string
}

/** Pure mapper, shared by the view's initial load and the create action. */
export function toTemplateDTO(doc: Template): TemplateConfigDTO {
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
