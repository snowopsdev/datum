import assert from 'node:assert/strict'
import test from 'node:test'

import type { Article, Template } from '../../cms/src/payload-types'
import type { LlmStage } from '../src/config'
import type { LlmClient, LlmRequest } from '../src/llm'
import { markdownToLexical } from '../src/richtext'
// `stages` before `qa/index`: the two import each other, and loading the
// stage module first is what lets `qaStage` finish initialising.
import type { StageContext } from '../src/stages'
import { stages } from '../src/stages'
import { loadStyleGuide } from '../src/styleGuide'

const qaStage = stages.find((s) => s.name === 'qa')!

/**
 * What the two QA reviewers are actually shown.
 *
 * The FAQ block was appended after the body as a bare `FAQ:` heading, so a
 * template that also requires an FAQ section in the body — How-To does — put
 * the same Q&As in front of the reviewer twice with nothing to say why. The
 * reviewer did the reasonable thing and failed the draft for repeating itself,
 * on every regeneration, forever: neither copy can be removed without breaking
 * a rule the template enforces. These tests pin the wording that stops that.
 */

const template: Template = {
  id: 1,
  name: 'How-To',
  outline: markdownToLexical('## Steps') as Template['outline'],
  requiredSections: [{ heading: 'Steps' }, { heading: 'FAQ' }],
  seoSpec: {
    titleTagMaxLength: 60,
    metaDescriptionMaxLength: 160,
    faqRequired: true,
    faqMinQuestions: 1,
    faqMaxQuestions: 4,
    ogTagsRequired: false,
  },
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
}

const article = (body: string): Article => ({
  id: 7,
  keyword: 'stream games',
  title: 'How to stream games',
  titleTag: 'How to stream games',
  metaDescription: 'A short guide.',
  faqItems: [{ question: 'Does it cost?', answer: 'Sometimes.' }],
  body: markdownToLexical(body) as Article['body'],
  template,
  status: 'drafted',
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
})

/** Captures every prompt, answers each stage with a passing verdict. */
function capturingLlm() {
  const prompts: Record<string, string> = {}
  const llm: LlmClient = {
    async completeJSON(stage: LlmStage, request: LlmRequest) {
      prompts[stage] = request.user
      return {
        json: { passed: true, notes: 'fine', sources: [] },
        provider: 'mock',
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      }
    },
  }
  return { llm, prompts }
}

function ctxWith(llm: LlmClient): StageContext {
  const created: unknown[] = []
  return {
    payload: {
      create: async (args: unknown) => {
        created.push(args)
        return {}
      },
      find: async () => ({ docs: [] }),
    } as never,
    runId: 'test-run',
    mode: 'mock',
    ahrefs: {} as never,
    styleGuide: loadStyleGuide(),
    models: {
      generate: 'mock',
      factCheck: 'mock',
      qualitativeReview: 'mock',
      claimExtraction: 'mock',
      informationGainJudge: 'mock',
      evidenceVerification: 'mock',
    },
    brandVoice: null,
    policy: {} as never,
    evidenceSources: [],
    llm,
  }
}

test('when the body has an FAQ section, both reviewers are told the FAQ entries mirror it on purpose', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.\n## FAQ\nDoes it cost? Sometimes.'), ctxWith(llm))

  for (const stage of ['factCheck', 'qualitativeReview']) {
    const prompt = prompts[stage]
    assert.ok(prompt, `${stage} was not called`)
    assert.match(prompt, /intentionally mirror the article's own FAQ section/)
    assert.match(prompt, /do not report them as duplicated content/)
    assert.doesNotMatch(prompt, /\nFAQ:\n/, 'the bare "FAQ:" label is what caused the misreading')
  }
})

test('when the body has no FAQ section, the entries are labelled as structured data outside the body', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWith(llm))

  assert.match(prompts.qualitativeReview, /structured data for search engines, not part of the body/)
  assert.doesNotMatch(prompts.qualitativeReview, /intentionally mirror/)
})

test('a "Frequently asked questions" heading counts as an FAQ section too', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(
    article('## Steps\nDo the thing.\n## Frequently asked questions\nDoes it cost? Sometimes.'),
    ctxWith(llm),
  )
  assert.match(prompts.qualitativeReview, /intentionally mirror/)
})
