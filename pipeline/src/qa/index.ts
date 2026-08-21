import { completeJSONLogged } from '../llm'
import { lexicalToPlainText, type RichText } from '../richtext'
import { resolveTemplate, type Stage } from '../stages'

import { runStructuralChecks } from './structuralChecks'

interface FactCheckVerdict {
  passed: boolean
  notes: string
  sources: string[]
}

interface QualitativeVerdict {
  passed: boolean
  notes: string
}

function parseFactCheck(json: unknown): FactCheckVerdict {
  const record = json as Record<string, unknown>
  if (typeof record?.passed !== 'boolean' || typeof record?.notes !== 'string') {
    throw new Error('factCheck verdict must have boolean "passed" and string "notes"')
  }
  const sources = Array.isArray(record.sources)
    ? record.sources.filter((s): s is string => typeof s === 'string')
    : []
  return { passed: record.passed, notes: record.notes, sources }
}

function parseQualitative(json: unknown): QualitativeVerdict {
  const record = json as Record<string, unknown>
  if (typeof record?.passed !== 'boolean' || typeof record?.notes !== 'string') {
    throw new Error('qualitativeReview verdict must have boolean "passed" and string "notes"')
  }
  return { passed: record.passed, notes: record.notes }
}

export const qaStage: Stage = {
  name: 'qa',
  entryStatus: 'drafted',
  exitStatus: 'qa_passed',
  async run(article, ctx) {
    const template = resolveTemplate(article)
    const violations = runStructuralChecks(article, template, ctx.styleGuide)

    const bodyText = article.body ? lexicalToPlainText(article.body as RichText) : ''
    const faqText =
      article.faqItems?.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n') || '(none)'

    const factResult = await completeJSONLogged(ctx, 'factCheck', article.id, {
      system:
        'You are a rigorous fact checker. Verify the factual claims in the article using web search. ' +
        'Return JSON: {"passed": boolean, "notes": string, "sources": string[]} where sources are the URLs you used.',
      user: `Fact-check this article about "${article.keyword}".\n\nTitle: ${article.title}\n\n${bodyText}\n\nFAQ:\n${faqText}`,
      needWebSearch: true,
    })
    const factCheck = parseFactCheck(factResult.json)

    const dos = template.dos?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const donts = template.donts?.map((d) => `- ${d.text}`).join('\n') || '(none)'
    const qualResult = await completeJSONLogged(ctx, 'qualitativeReview', article.id, {
      system:
        'You are an exacting content editor. Judge whether the article follows the style guide and the template rules. ' +
        'Return JSON: {"passed": boolean, "notes": string}.',
      user: `Style guide:\n${ctx.styleGuide.text}\n\nTemplate "${template.name}" dos:\n${dos}\n\nTemplate don'ts:\n${donts}\n\nArticle "${article.title}":\n\n${bodyText}\n\nFAQ:\n${faqText}`,
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
    const allPassed = structuralPassed && factCheck.passed && qualitativeReview.passed
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
