/**
 * The generate stage's prompts.
 *
 * `buildPrompt` is the article brief: template, SERP research, and — once the
 * research stage has captured a corpus snapshot — the consensus facets the
 * ranking pages agree on, the gaps they leave, and the rules that keep the
 * writer from filling those gaps with invented evidence. "Be original" without
 * those rules reads as an invitation to fabricate; `gapsBlock` is where that
 * boundary is stated, and the workspace's evidence bank is what the writer is
 * allowed to reach for on the other side of it.
 */

import type { Article, Template } from '../../cms/src/payload-types'

import { brandVoiceSamplesToPrompt, brandVoiceToPrompt, type BrandVoiceContent } from './brandVoice'
import { parseBrief } from './brief'
import {
  evidenceBankToPrompt,
  evidenceRules,
  type IcpContent,
  icpToPrompt,
  isEvidenceBankEmpty,
  positioningToPrompt,
  type TenantContext,
  workspaceProfileToPrompt,
} from './tenant'
import type { Facet, InformationGap } from './informationGain/lib'
import { lexicalToMarkdown, type RichText } from './richtext'

/** The surface a generated article is written for. */
const GENERATE_SURFACE = 'web'

/**
 * The approved brief, as instructions.
 *
 * This is the editor's voice in the prompt. Their notes outrank the template
 * outline where the two disagree, because the outline is generic guidance and
 * the notes are about *this* piece. Template sections stay listed even if the
 * editor cut them — structural QA enforces them regardless, and a draft that
 * omits one fails, so the writer had better know.
 */
export function briefBlock(raw: unknown): string[] {
  const brief = parseBrief(raw)
  if (!brief) return []
  const lines: string[] = []
  if (brief.angle) lines.push(`Angle: ${brief.angle}`)
  if (brief.audience) lines.push(`Audience: ${brief.audience}`)
  if (brief.sections.length > 0) {
    const rows = brief.sections
      .map((s) => {
        const tag = s.source === 'template' ? ' (required section)' : ''
        return `- ${s.heading}${tag}${s.notes ? `: ${s.notes}` : ''}`
      })
      .join('\n')
    lines.push(`Sections to cover, in this order:\n${rows}`)
  }
  if (brief.mustCover.length > 0) lines.push(`Must cover: ${brief.mustCover.join('; ')}`)
  if (brief.notes) {
    lines.push(
      `Direction from the editor — follow this over the template outline where they conflict:\n${brief.notes}`,
    )
  }
  return lines.length > 0 ? [`# Brief (approved by the editor)\n${lines.join('\n\n')}`] : []
}

/** `research.facets` / `research.gaps` are JSON columns, so trust nothing about their shape. */
function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

/**
 * The information-gain half of the brief: what the baseline already covers,
 * what it leaves open, how novelty may be sourced, the workspace's own facts,
 * and — on a re-run after a failed review — what went wrong last time.
 *
 * The facets and gaps are empty when the article has no snapshot yet, which
 * keeps pre-snapshot articles generating exactly as before. The evidence rules
 * are not: they used to appear only alongside facets or gaps, which left a
 * pre-snapshot article free to invent a customer count. They are now sent
 * whenever there is anything to say about the workspace — a company name, or a
 * bank — because the first-party boundary is not a consequence of having done
 * corpus research.
 */
export function gapsBlock(
  research: Article['research'],
  tenant: TenantContext,
  revisionNotes?: string | null,
): string[] {
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

  const bank = evidenceBankToPrompt(tenant.evidenceBank, {
    asOf: tenant.asOf,
    surface: GENERATE_SURFACE,
    companyName: tenant.profile.companyName,
  })
  const companyName = tenant.profile.companyName || tenant.profile.targetDomain || ''
  if (facets.length > 0 || gaps.length > 0 || companyName || bank) {
    sections.push(`# Evidence rules\n${evidenceRules(companyName, bank !== null)}`)
  }
  // Directly after the rules that point at it: the rules say "the Evidence bank
  // below", and a block that arrives after the revision notes makes a liar of them.
  if (bank) sections.push(bank)

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
  tenant: TenantContext,
): string {
  const outline = template.outline ? lexicalToMarkdown(template.outline as RichText) : '(none)'
  const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  // A worked piece in the template's own shape. Omitted entirely when unset, so
  // templates without one send no empty heading. It is a shape-and-register
  // reference: its subject is a different article, and copying its facts would
  // put unsourced claims into the draft for the information-gain stage to block.
  const example = template.example ? lexicalToMarkdown(template.example as RichText).trim() : ''
  const research = article.research
  const subtopics = research?.commonSubtopics?.map((s) => `- ${s.text}`).join('\n') || '(none)'
  const questions = research?.relatedQuestions?.map((q) => `- ${q.text}`).join('\n') || '(none)'
  const samples = brandVoice ? brandVoiceSamplesToPrompt(brandVoice) : null
  const hasEvidenceBank = !isEvidenceBankEmpty(tenant.evidenceBank)
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
    ...(example
      ? [
          `## Example\nA finished piece in this template's shape, about a different subject. Follow its structure, section order, and register. Do not reuse its wording, and do not carry over any of its facts — they belong to that article, not this one.\n\n${example}`,
        ]
      : []),
    ...(samples ? [samples] : []),
    `# SERP research`,
    `## Ranking pages\n${research?.rankingPagesSummary || '(none)'}`,
    `## Common subtopics\n${subtopics}`,
    `## Related questions\n${questions}`,
    ...briefBlock(article.brief),
    ...gapsBlock(research, tenant, article.revisionNotes),
    `# Output`,
    `Return a JSON object with exactly these keys: title, slug, titleTag, metaDescription, ogTitle, ogDescription, ogImage, faqItems (array of {question, answer}), bodyMarkdown.`,
    `bodyMarkdown uses ## for sections and ### for subsections, never # (the title is the page H1). Respect the SEO spec limits and the outline's section headings.`,
    ...(brandVoice ? ['Every field must follow the brand voice, not only bodyMarkdown.'] : []),
    // Only when there is a bank to cite. Asking for refs a workspace has no
    // entries for teaches the model to invent them, and an invented ref is a
    // fabricated citation dressed up as a checked one.
    ...(hasEvidenceBank
      ? [
          'Put an evidence ref in square brackets at the end of any sentence that states a first-party fact, e.g. [E3].',
        ]
      : []),
  ].join('\n\n')
}

/**
 * The system prompt: the platform style guide, then everything about the
 * tenant that governs how the piece is written.
 *
 * The order is deliberate and is what the golden tests pin. Style guide first
 * because it is the floor every workspace shares. Then the workspace — who the
 * company is — because the later blocks are statements about *its* market.
 * Then the brand voice, which decides the words. Then the audience, which
 * decides what those words have to land with. Then the positioning, which is
 * read as a constraint on how the company may be described to that audience.
 * A block that renders empty is omitted rather than sent as a bare heading.
 */
export function buildSystemPrompt(
  styleGuideText: string,
  brandVoice: BrandVoiceContent | null,
  tenant: TenantContext,
  icp: IcpContent | null,
): string {
  return [
    `You are a senior content writer. Follow this style guide exactly:\n\n${styleGuideText}`,
    workspaceProfileToPrompt(tenant.profile),
    brandVoice ? brandVoiceToPrompt(brandVoice) : '',
    icpToPrompt(icp),
    positioningToPrompt(tenant.positioning),
  ]
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
}
