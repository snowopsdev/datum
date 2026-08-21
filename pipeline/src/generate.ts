import type { Article, Template } from '../../cms/src/payload-types'

import { completeJSONLogged } from './llm'
import { lexicalToMarkdown, markdownToLexical, type RichText } from './richtext'
import { resolveTemplate, type Stage } from './stages'
import type { StyleGuide } from './styleGuide'

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

function buildPrompt(article: Article, template: Template, styleGuide: StyleGuide): string {
  const outline = template.outline ? lexicalToMarkdown(template.outline as RichText) : '(none)'
  const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
  const research = article.research
  const subtopics = research?.commonSubtopics?.map((s) => `- ${s.text}`).join('\n') || '(none)'
  const questions = research?.relatedQuestions?.map((q) => `- ${q.text}`).join('\n') || '(none)'
  return [
    `Write a complete article targeting the keyword: "${article.keyword}".`,
    `# Template: ${template.name}`,
    `## Outline\n${outline}`,
    `## Dos\n${dos}`,
    `## Don'ts\n${donts}`,
    `## SEO spec\n${JSON.stringify(template.seoSpec ?? {}, null, 2)}`,
    `# SERP research`,
    `## Ranking pages\n${research?.rankingPagesSummary || '(none)'}`,
    `## Common subtopics\n${subtopics}`,
    `## Related questions\n${questions}`,
    `# Output`,
    `Return a JSON object with exactly these keys: title, slug, titleTag, metaDescription, ogTitle, ogDescription, ogImage, faqItems (array of {question, answer}), bodyMarkdown.`,
    `bodyMarkdown uses ## for sections and ### for subsections, never # (the title is the page H1). Respect the SEO spec limits and the outline's section headings.`,
  ].join('\n\n')
}

export const generateStage: Stage = {
  name: 'generate',
  entryStatus: 'researched',
  exitStatus: 'drafted',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    const result = await completeJSONLogged(ctx, 'generate', article.id, {
      system: `You are a senior content writer. Follow this style guide exactly:\n\n${ctx.styleGuide.text}`,
      user: buildPrompt(article, template, ctx.styleGuide),
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
