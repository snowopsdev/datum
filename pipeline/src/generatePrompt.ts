import type { Article, Template } from '../../cms/src/payload-types'

import {
  brandVoiceSamplesToPrompt,
  brandVoiceToPrompt,
  type BrandVoiceContent,
} from './brandVoice'
import { lexicalToMarkdown, type RichText } from './richtext'

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
    `# Output`,
    `Return a JSON object with exactly these keys: title, slug, titleTag, metaDescription, ogTitle, ogDescription, ogImage, faqItems (array of {question, answer}), bodyMarkdown.`,
    `bodyMarkdown uses ## for sections and ### for subsections, never # (the title is the page H1). Respect the SEO spec limits and the outline's section headings.`,
    ...(brandVoice ? ['Every field must follow the brand voice, not only bodyMarkdown.'] : []),
  ].join('\n\n')
}

/** Platform style guide, plus the tenant's brand voice block when one is active. */
export function buildSystemPrompt(styleGuideText: string, brandVoice: BrandVoiceContent | null): string {
  const base = `You are a senior content writer. Follow this style guide exactly:\n\n${styleGuideText}`
  return brandVoice ? `${base}\n\n${brandVoiceToPrompt(brandVoice)}` : base
}
