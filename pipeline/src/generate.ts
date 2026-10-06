import type { Article } from '../../cms/src/payload-types'

import { buildPrompt, buildSystemPrompt } from './generatePrompt'
import { completeJSONLogged } from './llm'
import { markdownToLexical } from './richtext'
import { resolveTemplate, type Stage } from './stages'
import { evidenceRefsIn, selectIcp, stripEvidenceRefs } from './tenant'

interface GeneratedArticle {
  title: string
  slug: string
  titleTag: string
  metaDescription: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  faqItems: { question: string; answer: string }[]
  bodyMarkdown: string
}

function parseGenerated(json: unknown): GeneratedArticle {
  const record = json as Record<string, unknown>
  const stringFields = [
    'title',
    'slug',
    'titleTag',
    'metaDescription',
    'ogTitle',
    'ogDescription',
    'bodyMarkdown',
  ] as const
  for (const field of stringFields) {
    if (typeof record?.[field] !== 'string' || record[field] === '') {
      throw new Error(`generate output missing string field "${field}"`)
    }
  }
  // `ogImage` is asked for but not required: the model has no real image to
  // point at, so the only way it can satisfy a hard requirement is to invent a
  // URL, and a fabricated image link is worse than an absent one. Structural QA
  // already reports a missing one as OG_TAGS_MISSING, which puts it in front of
  // a human instead of throwing away a paid generate call.
  if (typeof record.ogImage !== 'string') record.ogImage = ''
  if (!Array.isArray(record.faqItems)) throw new Error('generate output missing faqItems array')
  for (const item of record.faqItems as unknown[]) {
    const faq = item as Record<string, unknown>
    if (typeof faq?.question !== 'string' || typeof faq?.answer !== 'string') {
      throw new Error('generate output faqItems entries need question and answer strings')
    }
  }
  return record as unknown as GeneratedArticle
}

/** One evidence-bank entry a draft leaned on, and the sentence that used it. */
export interface EvidenceCitation {
  ref: string
  excerpt: string
}

/**
 * Long enough to identify the sentence, short enough that a draft citing forty
 * entries does not turn its own citation list into a second copy of the article.
 */
const MAX_EXCERPT = 300

/** Leading markdown furniture, so an excerpt reads as a sentence and not as source. */
const MARKUP_PREFIX = /^\s*(?:#{1,6}\s*|[-*+]\s+|>\s*)+/

/**
 * The sentences of a generated string.
 *
 * Line breaks split as hard as full stops, because a markdown heading and a
 * list item are each their own statement and neither ends in a full stop — a
 * marker in a heading would otherwise drag the whole following paragraph in as
 * its excerpt.
 */
function sentencesOf(text: string): string[] {
  return text
    .split(/\r?\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Which bank entries this draft cited, and where.
 *
 * Run over every generated string field before the markers are stripped, so
 * `evidenceCitations` records what the writer actually claimed rather than what
 * a later reader can guess. QA's deterministic half checks these refs against
 * the bank, and the review view shows the reviewer the sentence each one is
 * carrying — a bare list of refs would make them hunt for it.
 */
export function extractEvidenceCitations(fields: (string | null | undefined)[]): EvidenceCitation[] {
  const seen = new Set<string>()
  const citations: EvidenceCitation[] = []
  for (const field of fields) {
    if (!field) continue
    for (const sentence of sentencesOf(field)) {
      const refs = evidenceRefsIn(sentence)
      if (refs.length === 0) continue
      const excerpt = stripEvidenceRefs(sentence).replace(MARKUP_PREFIX, '').trim().slice(0, MAX_EXCERPT)
      for (const ref of refs) {
        const key = `${ref}\u0000${excerpt}`
        if (seen.has(key)) continue
        seen.add(key)
        citations.push({ ref, excerpt })
      }
    }
  }
  return citations
}

export const generateStage: Stage = {
  name: 'generate',
  entryStatus: 'researched',
  exitStatus: 'drafted',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    // Resolved once, so the system prompt and anything later in this stage
    // describe the same audience even if the article's relationship is stale.
    const icp = selectIcp(ctx.tenant, article)
    const result = await completeJSONLogged(ctx, 'generate', article.id, {
      system: buildSystemPrompt(ctx.styleGuide.text, ctx.brandVoice, ctx.tenant, icp),
      user: buildPrompt(article, template, ctx.brandVoice, ctx.tenant),
    })
    const generated = parseGenerated(result.json)
    // Every string field, not only the body. A model told to cite its evidence
    // will put `[E3]` in a title tag, a slug, or an FAQ answer sooner or later,
    // and a marker that survives into the stored article is a leak a reader
    // sees. Collect first, then strip: after stripping there is nothing left to
    // record. `markdownToLexical` runs on the stripped body for the same reason.
    const citations = extractEvidenceCitations([
      generated.title,
      generated.slug,
      generated.titleTag,
      generated.metaDescription,
      generated.ogTitle,
      generated.ogDescription,
      generated.bodyMarkdown,
      ...generated.faqItems.flatMap((item) => [item.question, item.answer]),
    ])
    return {
      status: 'drafted',
      data: {
        title: stripEvidenceRefs(generated.title),
        slug: stripEvidenceRefs(generated.slug),
        titleTag: stripEvidenceRefs(generated.titleTag),
        metaDescription: stripEvidenceRefs(generated.metaDescription),
        ogTitle: stripEvidenceRefs(generated.ogTitle),
        ogDescription: stripEvidenceRefs(generated.ogDescription),
        ogImage: generated.ogImage,
        faqItems: generated.faqItems.map((item) => ({
          question: stripEvidenceRefs(item.question),
          answer: stripEvidenceRefs(item.answer),
        })),
        body: markdownToLexical(stripEvidenceRefs(generated.bodyMarkdown)) as Article['body'],
        evidenceCitations: citations,
        generationModel: result.model,
      },
    }
  },
}
