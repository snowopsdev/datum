import assert from 'node:assert/strict'
import test from 'node:test'

import { EVIDENCE_BANK_FIXTURE } from '../../cms/src/lib/tenant/fixtures'
import type { Article, Template } from '../../cms/src/payload-types'
import type { LlmStage } from '../src/config'
import type { LlmClient, LlmRequest } from '../src/llm'
import { lexicalToMarkdown, type RichText } from '../src/richtext'
// `stages` before `generate`: the two import each other, and loading the stage
// registry first is what lets `generateStage` finish initialising.
import type { StageContext } from '../src/stages'
import { stages } from '../src/stages'
import { extractEvidenceCitations } from '../src/generate'

const generateStage = stages.find((stage) => stage.name === 'generate')!
import { loadStyleGuide } from '../src/styleGuide'
import { emptyTenantContext, resolveWorkspaceProfile, type TenantContext } from '../src/tenant'

/**
 * What happens to the `[E3]` markers between the model and the database.
 *
 * They are an internal protocol: the prompt asks for them so QA can tell which
 * sentence claimed what, and no reader may ever see one. That means every
 * generated string field is stripped, not only the body — a model told to cite
 * its evidence will put a ref in a title tag or a slug sooner or later — and
 * the citations have to be collected *before* the stripping, because
 * afterwards there is nothing left to record.
 */

const template: Template = {
  id: 1,
  name: 'How-To',
  requiredSections: [],
  seoSpec: { titleTagMaxLength: 60, metaDescriptionMaxLength: 160 },
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
}

const article = {
  id: 7,
  keyword: 'governed content',
  status: 'researched',
  template,
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
} as unknown as Article

const GENERATED = {
  title: 'How the reviewer gate works [E1]',
  slug: 'how-the-reviewer-gate-works-[E1]',
  titleTag: 'The reviewer gate [E1]',
  metaDescription: 'A reviewer approves the brief before drafting is paid for [E1].',
  ogTitle: 'The reviewer gate [E1]',
  ogDescription: 'Every draft carries a stored fact check [E2].',
  ogImage: '',
  faqItems: [
    { question: 'Does a person read the brief [E1]?', answer: 'Yes. A reviewer approves it first [E1].' },
  ],
  bodyMarkdown: [
    '## What the gate does [E1]',
    '',
    'A reviewer approves the brief before any drafting is paid for [E1]. That is the whole mechanism.',
    '',
    'Every published draft carries a stored fact check, style review, and information-gain score [E2].',
    '',
    'See the [docs](https://example.com) for [sic] the rest.',
  ].join('\n'),
}

function ctxWith(overrides: Partial<StageContext> = {}): {
  ctx: StageContext
  requests: Record<string, LlmRequest>
} {
  const requests: Record<string, LlmRequest> = {}
  const llm: LlmClient = {
    async completeJSON(stage: LlmStage, request: LlmRequest) {
      requests[stage] = request
      return {
        json: JSON.parse(JSON.stringify(GENERATED)),
        provider: 'mock',
        model: 'mock-generate',
        usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      }
    },
  }
  const tenant: TenantContext = {
    ...emptyTenantContext('2026-09-02'),
    profile: resolveWorkspaceProfile({ companyName: 'Datum' }, {}),
    evidenceBank: EVIDENCE_BANK_FIXTURE,
  }
  return {
    ctx: {
      payload: { create: async () => ({}), find: async () => ({ docs: [] }) } as never,
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
        evidenceCheck: 'mock',
      },
      brandVoice: null,
      policy: {} as never,
      evidenceSources: [],
      tenant,
      llm,
      ...overrides,
    } as unknown as StageContext,
    requests,
  }
}

test('every generated string field reaches the database with its markers stripped', async () => {
  const { ctx } = ctxWith()
  const outcome = await generateStage.run(article, ctx)
  const data = outcome.data as Record<string, unknown>

  assert.equal(data.title, 'How the reviewer gate works')
  assert.equal(data.slug, 'how-the-reviewer-gate-works-')
  assert.equal(data.titleTag, 'The reviewer gate')
  assert.equal(data.metaDescription, 'A reviewer approves the brief before drafting is paid for.')
  assert.equal(data.ogTitle, 'The reviewer gate')
  assert.equal(data.ogDescription, 'Every draft carries a stored fact check.')
  assert.deepEqual(data.faqItems, [
    { question: 'Does a person read the brief?', answer: 'Yes. A reviewer approves it first.' },
  ])

  const body = lexicalToMarkdown(data.body as RichText)
  assert.ok(!/\[E\d+\]/.test(body), `a marker survived into the body: ${body}`)
  assert.match(body, /## What the gate does/)
  // Other bracketed text is not a citation marker and must survive untouched.
  assert.match(body, /\[docs\]\(https:\/\/example\.com\)/)
  assert.match(body, /\[sic\]/)
})

test('the citations record the sentence that carried each marker', async () => {
  const { ctx } = ctxWith()
  const outcome = await generateStage.run(article, ctx)
  const citations = (outcome.data as Record<string, unknown>).evidenceCitations as {
    ref: string
    excerpt: string
  }[]

  assert.ok(Array.isArray(citations))
  assert.deepEqual([...new Set(citations.map((c) => c.ref))].sort(), ['E1', 'E2'])
  // The sentence, not the paragraph and not the whole field.
  assert.ok(
    citations.some(
      (c) =>
        c.ref === 'E1' &&
        c.excerpt === 'A reviewer approves the brief before any drafting is paid for.',
    ),
    JSON.stringify(citations, null, 2),
  )
  // A heading is its own statement, and loses its markdown furniture.
  assert.ok(citations.some((c) => c.ref === 'E1' && c.excerpt === 'What the gate does'))
  // Meta fields and FAQ answers count too.
  assert.ok(citations.some((c) => c.excerpt === 'The reviewer gate'))
  assert.ok(citations.some((c) => c.excerpt === 'Yes.' || c.excerpt === 'A reviewer approves it first.'))
  assert.ok(citations.every((c) => !/\[E\d+\]/.test(c.excerpt)), 'excerpts carry no markers either')
})

test('the generate prompt carries the bank the citations are checked against', async () => {
  const { ctx, requests } = ctxWith()
  await generateStage.run(article, ctx)
  assert.match(requests.generate.user, /# Evidence bank \(the only first-party facts you may state about Datum\)/)
  assert.match(requests.generate.user, /# Evidence rules/)
  assert.match(requests.generate.system, /# Workspace/)
})

test('a workspace with no bank records no citations and stores the draft unchanged', async () => {
  const { ctx } = ctxWith({ tenant: emptyTenantContext('2026-09-02') })
  const outcome = await generateStage.run(article, ctx)
  const data = outcome.data as Record<string, unknown>
  // The markers are still stripped: the model put them there whether the
  // workspace asked for them or not, and a leaked `[E1]` is a leaked `[E1]`.
  assert.equal(data.title, 'How the reviewer gate works')
  // The refs are still recorded, and QA's deterministic half will report every
  // one of them as unknown — which is exactly the finding a reviewer needs.
  const citations = data.evidenceCitations as { ref: string }[]
  assert.deepEqual([...new Set(citations.map((c) => c.ref))].sort(), ['E1', 'E2'])
})

test('a lower-cased marker is stripped and recorded as the entry it names', async () => {
  // Models copy the ref out of the prompt by eye and lower-case it often
  // enough to matter. A citation stored as `e1` would look to QA like a
  // hallucination, and a marker left in the body is one a reader sees.
  const shouted = { ...GENERATED, bodyMarkdown: 'A reviewer approves the brief [e1]. It holds [f4].' }
  const { ctx } = ctxWith()
  const outcome = await generateStage.run(article, {
    ...ctx,
    llm: {
      async completeJSON() {
        return {
          json: JSON.parse(JSON.stringify(shouted)),
          provider: 'mock',
          model: 'mock-generate',
          usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
        }
      },
    },
  } as unknown as StageContext)
  const data = outcome.data as Record<string, unknown>
  const body = lexicalToMarkdown(data.body as RichText)
  assert.ok(!/\[[EFRefr]\d+\]/.test(body), `a marker survived into the body: ${body}`)
  // `E2` comes from the meta fields, which this case leaves as they were.
  const citations = data.evidenceCitations as { ref: string; excerpt: string }[]
  assert.deepEqual([...new Set(citations.map((c) => c.ref))].sort(), ['E1', 'E2', 'F4'])
  assert.ok(citations.some((c) => c.ref === 'F4' && c.excerpt === 'It holds.'))
})

test('extractEvidenceCitations caps an excerpt and de-duplicates identical rows', () => {
  const long = `${'word '.repeat(200)}[E1]`
  const [only] = extractEvidenceCitations([long])
  assert.equal(only.ref, 'E1')
  assert.equal(only.excerpt.length, 300)

  const repeated = extractEvidenceCitations(['Same sentence [E1].', 'Same sentence [E1].'])
  assert.equal(repeated.length, 1)

  // One entry, cited twice in two cases, is one entry.
  const shouted = extractEvidenceCitations(['Same sentence [E1].', 'Same sentence [e1].'])
  assert.deepEqual(shouted, [{ ref: 'E1', excerpt: 'Same sentence.' }])

  assert.deepEqual(extractEvidenceCitations([null, undefined, '', 'No refs here.']), [])
})
