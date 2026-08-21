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
