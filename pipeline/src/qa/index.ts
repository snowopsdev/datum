import { bannedWordsOf, brandVoiceToPrompt } from '../brandVoice'
import { completeJSONLogged } from '../llm'
import {
  extractHeadings,
  lexicalToMarkdown,
  lexicalToPlainText,
  type RichText,
} from '../richtext'
import { resolveTemplate, type Stage } from '../stages'

import { runStructuralChecks } from './structuralChecks'
import { decideQualitative, parseFactCheck, parseQualitative } from './verdicts'

const BASE_QUALITATIVE_SYSTEM =
  'You are an exacting content editor. Judge whether the article follows the style guide and the template rules. '

const LEGACY_SHAPE = 'Return JSON: {"passed": boolean, "notes": string}.'

const BRAND_VOICE_SHAPE =
  'Also judge brand voice fit against the "Brand voice (tenant)" section: score it 1–5 as voiceScore with a short voiceNotes explanation. ' +
  'List notTraitViolations ONLY for a clear breach of a "What we are NOT" trait; each entry must quote the offending text verbatim as excerpt. ' +
  'If there is no clear breach, return an empty array — do not fail the article on voice fit alone. ' +
  'Return JSON: {"passed": boolean, "notes": string, "voiceScore": number, "voiceNotes": string, "notTraitViolations": [{"trait": string, "excerpt": string, "explanation": string}]}.'

export const qaStage: Stage = {
  name: 'qa',
  entryStatus: 'drafted',
  exitStatus: 'qa_passed',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    const violations = runStructuralChecks(article, template, ctx.styleGuide, {
      brandBannedWords: ctx.brandVoice ? bannedWordsOf(ctx.brandVoice) : [],
    })

    const bodyText = article.body ? lexicalToPlainText(article.body as RichText) : ''
    // Markdown, not plain text, for the qualitative reviewer: templates state
    // structural rules ("each item name belongs in an H2") and plain text drops
    // every heading marker, so the reviewer cannot see heading levels at all. It
    // guesses, and a wrong guess is unrecoverable — structural QA passes, the
    // reviewer fails the same article forever, and every regeneration hits the
    // identical invisible wall. The fact checker keeps plain text: it judges
    // claims, not layout.
    const bodyMarkdown = article.body ? lexicalToMarkdown(article.body as RichText) : ''
    const faqText =
      article.faqItems?.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '(none)'

    // `faqItems` is structured data for search engines, and templates like
    // How-To also require an "FAQ" H2 in the body — so for those the same Q&As
    // legitimately exist twice, once rendered and once as markup. Appending the
    // FAQ block after the body without saying so made every reviewer report the
    // article as repeating itself, an unfixable complaint: removing either copy
    // breaks a rule the template enforces. Say which is which instead.
    const bodyHasFaqSection = article.body
      ? extractHeadings(article.body as RichText).some((h) => /\bfaq\b|frequently asked/i.test(h.text))
      : false
    const faqBlock = bodyHasFaqSection
      ? `FAQ entries (structured data for search engines — these intentionally mirror the article's own FAQ section, so do not report them as duplicated content):\n${faqText}`
      : `FAQ entries (structured data for search engines, not part of the body):\n${faqText}`

    const factResult = await completeJSONLogged(ctx, 'factCheck', article.id, {
      system:
        'You are a rigorous fact checker. Verify the factual claims in the article using web search. ' +
        'Return JSON: {"passed": boolean, "notes": string, "sources": string[]} where sources are the URLs you used.',
      user: `Fact-check this article about "${article.keyword}".\n\nTitle: ${article.title}\n\n${bodyText}\n\n${faqBlock}`,
      needWebSearch: true,
    })
    const factCheck = parseFactCheck(factResult.json)

    const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const brandVoiceBlock = ctx.brandVoice ? `\n\n${brandVoiceToPrompt(ctx.brandVoice)}` : ''
    // The brand voice governs every generated field, so the meta fields are reviewed too.
    const metaText = [
      `Title tag: ${article.titleTag ?? '(none)'}`,
      `Meta description: ${article.metaDescription ?? '(none)'}`,
      `OG title: ${article.ogTitle ?? '(none)'}`,
      `OG description: ${article.ogDescription ?? '(none)'}`,
    ].join('\n')
    const qualResult = await completeJSONLogged(ctx, 'qualitativeReview', article.id, {
      system: BASE_QUALITATIVE_SYSTEM + (ctx.brandVoice ? BRAND_VOICE_SHAPE : LEGACY_SHAPE),
      user: `Style guide:\n${ctx.styleGuide.text}${brandVoiceBlock}\n\nTemplate "${template.name}" dos:\n${dos}\n\nTemplate don'ts:\n${donts}\n\nArticle "${article.title}":\n\n${metaText}\n\n${bodyMarkdown}\n\n${faqBlock}`,
    })
    const qualitativeReview = parseQualitative(qualResult.json)

    // Sum after the QA calls so this article's own factCheck/qualitativeReview
    // rows are included in its total.
    const costRows = await ctx.payload.find({
      collection: 'cost-log',
      where: { article: { equals: article.id } },
      pagination: false,
      depth: 0,
    })
    const totalCostUsd = costRows.docs.reduce((sum, row) => sum + (row.costUsd ?? 0), 0)

    const structuralPassed = violations.length === 0
    const allPassed = structuralPassed && factCheck.passed && decideQualitative(qualitativeReview)
    return {
      status: allPassed ? 'qa_passed' : 'needs_revision',
      data: {
        qaResults: {
          structural: { passed: structuralPassed, violations },
          factCheck: {
            passed: factCheck.passed,
            notes: factCheck.notes,
            sources: factCheck.sources,
          },
          qualitativeReview,
        },
        qaModels: { factCheck: factResult.model, qualitativeReview: qualResult.model },
        totalCostUsd,
      },
    }
  },
}
