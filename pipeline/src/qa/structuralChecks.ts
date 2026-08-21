import type { Article, Template } from '../../../cms/src/payload-types'

import { extractHeadings, lexicalToPlainText, type RichText } from '../richtext'
import type { StyleGuide } from '../styleGuide'

export type HeadingProblem = 'multiple_h1' | 'skipped_level' | 'missing_section'

export type Violation =
  | { code: 'TITLE_TAG_TOO_LONG'; limit: number; actual: number; titleTag: string }
  | { code: 'META_DESCRIPTION_TOO_LONG'; limit: number; actual: number; metaDescription: string }
  | { code: 'HEADING_STRUCTURE'; problem: HeadingProblem; heading: string; detail: string }
  | { code: 'FAQ_COUNT_OUT_OF_RANGE'; min: number; max: number | null; actual: number }
  | { code: 'OG_TAGS_MISSING'; missing: ('ogTitle' | 'ogDescription' | 'ogImage')[] }
  | { code: 'READING_LEVEL_TOO_HIGH'; limit: number; actual: number }
  | { code: 'BANNED_PHRASE'; phrase: string; field: string; context: string }

const READING_GRADE_LIMIT = 11

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  const groups = w.match(/[aeiouy]+/g)?.length ?? 0
  let syllables = groups
  if (w.endsWith('e') && !w.endsWith('le') && groups > 1) syllables -= 1
  return Math.max(1, syllables)
}

export function fleschKincaidGrade(text: string): number | null {
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
  if (words.length === 0) return null
  const sentences = Math.max(1, (text.match(/[.!?]+(?=\s|$)/g) ?? []).length)
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0)
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function bannedPhraseViolations(field: string, text: string, phrases: string[]): Violation[] {
  const violations: Violation[] = []
  for (const phrase of phrases) {
    const pattern = new RegExp(`(?<![a-zA-Z0-9])${escapeRegex(phrase)}(?![a-zA-Z0-9])`, 'gi')
    for (const match of text.matchAll(pattern)) {
      const start = Math.max(0, (match.index ?? 0) - 30)
      const end = Math.min(text.length, (match.index ?? 0) + phrase.length + 30)
      violations.push({
        code: 'BANNED_PHRASE',
        phrase,
        field,
        context: `…${text.slice(start, end).replace(/\n/g, ' ')}…`,
      })
    }
  }
  return violations
}

function headingViolations(article: Article, template: Template): Violation[] {
  const violations: Violation[] = []
  if (!article.body) return violations
  const headings = extractHeadings(article.body as RichText)

  // The article title renders as the page's H1, so any h1 inside the body
  // makes more than one H1 on the page.
  const bodyH1s = headings.filter((h) => h.level === 1)
  const totalH1s = bodyH1s.length + (article.title ? 1 : 0)
  if (totalH1s > 1) {
    violations.push({
      code: 'HEADING_STRUCTURE',
      problem: 'multiple_h1',
      heading: bodyH1s[0]?.text ?? article.title ?? '',
      detail: `${totalH1s} H1s found (title counts as the page H1); expected exactly one`,
    })
  }

  let previousLevel = 1 // title-as-h1 baseline
  for (const heading of headings) {
    if (heading.level > previousLevel + 1) {
      violations.push({
        code: 'HEADING_STRUCTURE',
        problem: 'skipped_level',
        heading: heading.text,
        detail: `h${heading.level} "${heading.text}" follows level h${previousLevel}, skipping h${previousLevel + 1}`,
      })
    }
    previousLevel = heading.level
  }

  if (template.outline) {
    const bodyH2s = new Set(headings.filter((h) => h.level === 2).map((h) => h.text.toLowerCase()))
    const outlineH2s = extractHeadings(template.outline as RichText).filter((h) => h.level === 2)
    for (const section of outlineH2s) {
      if (!bodyH2s.has(section.text.toLowerCase())) {
        violations.push({
          code: 'HEADING_STRUCTURE',
          problem: 'missing_section',
          heading: section.text,
          detail: `outline section "${section.text}" has no matching H2 in the body`,
        })
      }
    }
  }
  return violations
}

/** Pure, deterministic, zero-LLM checks against the template's SEO spec and the style guide. */
export function runStructuralChecks(
  article: Article,
  template: Template,
  styleGuide: StyleGuide,
): Violation[] {
  const violations: Violation[] = []
  const seo = template.seoSpec ?? {}

  const titleTagLimit = seo.titleTagMaxLength ?? 60
  if (article.titleTag && article.titleTag.length > titleTagLimit) {
    violations.push({
      code: 'TITLE_TAG_TOO_LONG',
      limit: titleTagLimit,
      actual: article.titleTag.length,
      titleTag: article.titleTag,
    })
  }

  const metaLimit = seo.metaDescriptionMaxLength ?? 160
  if (article.metaDescription && article.metaDescription.length > metaLimit) {
    violations.push({
      code: 'META_DESCRIPTION_TOO_LONG',
      limit: metaLimit,
      actual: article.metaDescription.length,
      metaDescription: article.metaDescription,
    })
  }

  violations.push(...headingViolations(article, template))

  if (seo.faqRequired) {
    const min = seo.faqMinQuestions ?? 1
    const max = seo.faqMaxQuestions ?? null
    const actual = article.faqItems?.length ?? 0
    if (actual < min || (max !== null && actual > max)) {
      violations.push({ code: 'FAQ_COUNT_OUT_OF_RANGE', min, max, actual })
    }
  }

  if (seo.ogTagsRequired) {
    const missing: ('ogTitle' | 'ogDescription' | 'ogImage')[] = []
    if (!article.ogTitle) missing.push('ogTitle')
    if (!article.ogDescription) missing.push('ogDescription')
    if (!article.ogImage) missing.push('ogImage')
    if (missing.length > 0) violations.push({ code: 'OG_TAGS_MISSING', missing })
  }

  const bodyText = article.body ? lexicalToPlainText(article.body as RichText) : ''
  if (bodyText) {
    const grade = fleschKincaidGrade(bodyText)
    if (grade !== null && grade > READING_GRADE_LIMIT) {
      violations.push({
        code: 'READING_LEVEL_TOO_HIGH',
        limit: READING_GRADE_LIMIT,
        actual: Math.round(grade * 10) / 10,
      })
    }
  }

  const textFields: [string, string | null | undefined][] = [
    ['body', bodyText],
    ['title', article.title],
    ['titleTag', article.titleTag],
    ['metaDescription', article.metaDescription],
    ['faqItems', article.faqItems?.map((f) => `${f.question} ${f.answer}`).join('\n')],
  ]
  for (const [field, text] of textFields) {
    if (text) violations.push(...bannedPhraseViolations(field, text, styleGuide.bannedPhrases))
  }

  return violations
}
