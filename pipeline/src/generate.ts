import type { Article, Template } from '../../cms/src/payload-types'

import { buildPrompt, buildSystemPrompt } from './generatePrompt'
import { completeJSONLogged } from './llm'
import { markdownToLexical } from './richtext'
import { resolveTemplate, type Stage } from './stages'

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
    'ogImage',
    'bodyMarkdown',
  ] as const
  for (const field of stringFields) {
    if (typeof record?.[field] !== 'string' || record[field] === '') {
      throw new Error(`generate output missing string field "${field}"`)
    }
  }
  if (!Array.isArray(record.faqItems)) throw new Error('generate output missing faqItems array')
  for (const item of record.faqItems as unknown[]) {
    const faq = item as Record<string, unknown>
    if (typeof faq?.question !== 'string' || typeof faq?.answer !== 'string') {
      throw new Error('generate output faqItems entries need question and answer strings')
    }
  }
  return record as unknown as GeneratedArticle
}

export const generateStage: Stage = {
  name: 'generate',
  entryStatus: 'researched',
  exitStatus: 'drafted',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    const result = await completeJSONLogged(ctx, 'generate', article.id, {
      system: buildSystemPrompt(ctx.styleGuide.text, ctx.brandVoice),
      user: buildPrompt(article, template, ctx.brandVoice),
    })
    const generated = parseGenerated(result.json)
    return {
      status: 'drafted',
      data: {
        title: generated.title,
        slug: generated.slug,
        titleTag: generated.titleTag,
        metaDescription: generated.metaDescription,
        ogTitle: generated.ogTitle,
        ogDescription: generated.ogDescription,
        ogImage: generated.ogImage,
        faqItems: generated.faqItems,
        body: markdownToLexical(generated.bodyMarkdown) as Article['body'],
        generationModel: result.model,
      },
    }
  },
}
