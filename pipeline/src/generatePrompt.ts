/**
 * The generate stage's prompts.
 *
 * `buildPrompt` is the article brief: template, SERP research, and — once the
 * research stage has captured a corpus snapshot — the consensus facets the
 * ranking pages agree on, the gaps they leave, and the rules that keep the
 * writer from filling those gaps with invented evidence. Datum has no
 * first-party data, so "be original" without those rules reads as an
 * invitation to fabricate; `gapsBlock` is where that boundary is stated.
 */

import type { Article, Template } from '../../cms/src/payload-types'

import { brandVoiceSamplesToPrompt, brandVoiceToPrompt, type BrandVoiceContent } from './brandVoice'
import type { Facet, InformationGap } from './informationGain/lib'
import { lexicalToMarkdown, type RichText } from './richtext'

/**
 * The novelty boundary, stated verbatim in every prompt that carries facets or
 * gaps. Kept as one constant so the QA judge's expectations and the writer's
 * instructions cannot drift apart.
 */
export const EVIDENCE_RULES =
  'Do not invent unique insights. Add a novel factual claim only when you can name the ' +
  'public source (organisation and document) a fact-checker could find; otherwise state it ' +
  "as an explicitly labelled inference (for example, 'In our reading of the guidance…'). " +
  'Never present first-party measurements, tests, surveys, or datasets — Datum has none. ' +
  'Prefer covering every consensus facet over adding novelty. Every number, date, and ' +
  'percentage must be one you can attribute.'

/** `research.facets` / `research.gaps` are JSON columns, so trust nothing about their shape. */
function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/**
 * The information-gain half of the brief: what the baseline already covers,
 * what it leaves open, how novelty may be sourced, and — on a re-run after a
 * failed review — what went wrong last time. Empty when the article has no
 * snapshot yet, which keeps pre-snapshot articles generating exactly as before.
 */
export function gapsBlock(research: Article['research'], revisionNotes?: string | null): string[] {
  const facets = jsonArray<Facet>(research?.facets)
  const gaps = jsonArray<InformationGap>(research?.gaps)
  const notes = revisionNotes?.trim() ?? ''
  const sections: string[] = []

  if (facets.length > 0) {
    const bullets = facets
      .map((facet) => {
        const coverage = facet.mustHave
          ? ' (required by template)'
          : // "baseline sources", not "ranking pages": docCount counts every
            // baseline document, our own published articles included.
            ` (covered by ${facet.docCount} baseline source${facet.docCount === 1 ? '' : 's'})`
        return `- ${facet.label}${coverage}: ${facet.description}`
      })
      .join('\n')
    sections.push(`# Consensus facets (must cover)\n${bullets}`)
  }

  if (gaps.length > 0) {
    const bullets = gaps
      .map(
        (gap) =>
          `- ${gap.label}: ${gap.description} Evidence that would settle it: ${gap.evidenceHint}`,
      )
      .join('\n')
    sections.push(`# Information gaps (opportunities)\n${bullets}`)
  }

  if (facets.length > 0 || gaps.length > 0) {
    sections.push(`# Evidence rules\n${EVIDENCE_RULES}`)
  }

  if (notes.length > 0) {
    sections.push(
      `# Revision notes (previous attempt)\n${notes}\n\nFix these before anything else.`,
    )
  }

  return sections
}

/** Non-blank secondary keywords the operator grouped into this article. */
export function secondaryKeywordsOf(article: { secondaryKeywords?: { keyword?: string | null }[] | null }): string[] {
  return (article.secondaryKeywords ?? [])
    .map((row) => row.keyword?.trim())
    .filter((k): k is string => Boolean(k))
}

export function buildPrompt(
  article: Article,
  template: Template,
  brandVoice: BrandVoiceContent | null,
): string {
  const outline = template.outline ? lexicalToMarkdown(template.outline as RichText) : '(none)'
  const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  const research = article.research
  const subtopics = research?.commonSubtopics?.map((s) => `- ${s.text}`).join('\n') || '(none)'
  const questions = research?.relatedQuestions?.map((q) => `- ${q.text}`).join('\n') || '(none)'
  const samples = brandVoice ? brandVoiceSamplesToPrompt(brandVoice) : null
  return [
    `Write a complete article targeting the keyword: "${article.keyword}".`,
    // One article is expected to cover the whole group the operator picked, so
    // the secondaries have to reach the writer — otherwise they only ever
    // affect scoring, and the draft never earns the coverage they represent.
    ...(secondaryKeywordsOf(article).length > 0
      ? [
          `It must also cover these related searches, each with its own section or clearly addressed passage: ${secondaryKeywordsOf(article)
            .map((k) => `"${k}"`)
            .join(', ')}.`,
        ]
      : []),
    `# Template: ${template.name}`,
    `## Outline\n${outline}`,
    `## Dos\n${dos}`,
    `## Don'ts\n${donts}`,
    `## SEO spec\n${JSON.stringify(template.seoSpec ?? {}, null, 2)}`,
    ...(samples ? [samples] : []),
    `# SERP research`,
    `## Ranking pages\n${research?.rankingPagesSummary || '(none)'}`,
    `## Common subtopics\n${subtopics}`,
    `## Related questions\n${questions}`,
    ...gapsBlock(research, article.revisionNotes),
    `# Output`,
    `Return a JSON object with exactly these keys: title, slug, titleTag, metaDescription, ogTitle, ogDescription, ogImage, faqItems (array of {question, answer}), bodyMarkdown.`,
    `bodyMarkdown uses ## for sections and ### for subsections, never # (the title is the page H1). Respect the SEO spec limits and the outline's section headings.`,
    ...(brandVoice ? ['Every field must follow the brand voice, not only bodyMarkdown.'] : []),
  ].join('\n\n')
}

/** Platform style guide, plus the tenant's brand voice block when one is active. */
export function buildSystemPrompt(
  styleGuideText: string,
  brandVoice: BrandVoiceContent | null,
): string {
  const base = `You are a senior content writer. Follow this style guide exactly:\n\n${styleGuideText}`
  return brandVoice ? `${base}\n\n${brandVoiceToPrompt(brandVoice)}` : base
}
