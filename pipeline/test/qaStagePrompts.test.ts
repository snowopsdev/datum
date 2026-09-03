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
import {
  emptyIcpContent,
  emptyPositioningContent,
  emptyTenantContext,
  resolveWorkspaceProfile,
} from '../src/tenant'
import { EVIDENCE_BANK_FIXTURE } from '../../cms/src/lib/tenant/fixtures'

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
  const systems: Record<string, string> = {}
  const llm: LlmClient = {
    async completeJSON(stage: LlmStage, request: LlmRequest) {
      prompts[stage] = request.user
      systems[stage] = request.system
      return {
        json: { passed: true, notes: 'fine', sources: [] },
        provider: 'mock',
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      }
    },
  }
  return { llm, prompts, systems }
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
      evidenceCheck: 'mock',
    },
    brandVoice: null,
    policy: {} as never,
    evidenceSources: [],
    tenant: emptyTenantContext(),
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

/**
 * The qualitative reviewer sees the audience the writer was given.
 *
 * Without it the reviewer judges register and usefulness against a reader it
 * has to invent, then fails drafts for being pitched at the wrong person — an
 * unfixable complaint, because nothing in the draft can tell it who the reader
 * actually is. The fact checker deliberately does not get it: it judges claims
 * against the world, not against a reader.
 */
const AUDIENCE = {
  ...emptyIcpContent('Café owners'),
  id: 3,
  status: 'active' as const,
  primary: true,
  who: 'Owners of one or two independent cafés',
  pains: [{ statement: 'Staff pull inconsistent shots', evidence: [], confidence: 'inference' as const }],
}

const ctxWithAudience = (llm: LlmClient): StageContext => ({
  ...ctxWith(llm),
  tenant: { ...emptyTenantContext(), icps: [AUDIENCE] },
})

test('the qualitative reviewer is given the article’s audience, and the fact checker is not', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWithAudience(llm))

  assert.match(prompts.qualitativeReview, /# Audience: Café owners \(primary ICP\)/)
  assert.match(prompts.qualitativeReview, /Owners of one or two independent cafés/)
  assert.match(prompts.qualitativeReview, /\[inference\]/)
  assert.doesNotMatch(prompts.factCheck, /# Audience:/)
})

test('a workspace with no audience sends no empty heading to the reviewer', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWith(llm))
  assert.doesNotMatch(prompts.qualitativeReview, /# Audience:/)
})

/**
 * The reviewer sees the position too, and is told it is advisory.
 *
 * Without the block the reviewer cannot tell a drifting draft from a correct
 * one. Without the advisory sentence it treats the avoid list as a banned-word
 * list and fails drafts on taste, which would make the reviewer the arbiter of
 * positioning — a decision nobody reviewed.
 */
const ctxWithPositioning = (llm: LlmClient): StageContext => ({
  ...ctxWith(llm),
  tenant: {
    ...emptyTenantContext(),
    icps: [AUDIENCE],
    positioning: {
      ...emptyPositioningContent(),
      category: 'espresso equipment guides',
      activePosition: 'the guides that admit what they do not know',
      vocabularyAvoid: [{ term: 'game-changing', note: 'says nothing' }],
    },
  },
})

test('the qualitative reviewer is given the positioning, after the audience', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWithPositioning(llm))

  const prompt = prompts.qualitativeReview
  assert.match(prompt, /# Positioning/)
  assert.match(prompt, /Position we occupy: "the guides that admit what they do not know"/)
  assert.ok(prompt.indexOf('# Audience: Café owners') < prompt.indexOf('# Positioning'))
  // The fact checker judges claims against the world, not against a position.
  assert.doesNotMatch(prompts.factCheck, /# Positioning/)
})

test('the reviewer is told the positioning notes are advisory, and only when there is one', async () => {
  const withPosition = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWithPositioning(withPosition.llm))
  assert.match(
    withPosition.systems.qualitativeReview,
    /Also note, under notes, any use of the positioning's 'Avoid' vocabulary and any drift from the stated position; these are advisory and never fail the article on their own\./,
  )

  const without = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWithAudience(without.llm))
  assert.doesNotMatch(without.systems.qualitativeReview, /advisory/)
  assert.doesNotMatch(without.prompts.qualitativeReview, /# Positioning/)
})

/**
 * The evidence check is a different call from the fact check, on purpose.
 *
 * The fact checker searches the open web and judges public claims. This one is
 * closed-book: it compares the draft's sentences about the workspace against a
 * list. Giving it the whole bank uncapped matters — the writer saw the newest
 * forty claims, and a claim past that cap would read as unbacked when it is not.
 */
const ctxWithBank = (llm: LlmClient): StageContext => ({
  ...ctxWith(llm),
  tenant: {
    ...emptyTenantContext('2026-09-02'),
    profile: resolveWorkspaceProfile({ companyName: 'Datum', targetDomain: 'datum.example.com' }, {}),
    evidenceBank: EVIDENCE_BANK_FIXTURE,
  },
})

const citing = (body: string, citations: { ref: string; excerpt: string }[]): Article => ({
  ...article(body),
  evidenceCitations: citations,
})

/**
 * A draft that passes structural QA, so the status assertions below are about
 * the evidence check and nothing else.
 */
const SOUND_BODY = '## Steps\nDo the thing.\n## FAQ\nDoes it cost? Sometimes.'

test('the evidence check receives the workspace block, the uncapped bank, and the declared refs', async () => {
  const { llm, prompts, systems } = capturingLlm()
  await qaStage.run(
    citing('## Steps\nDo the thing.', [
      { ref: 'E1', excerpt: 'A reviewer approves the brief before drafting is paid for.' },
      { ref: 'F4', excerpt: 'Datum runs on Payload CMS and Postgres.' },
    ]),
    ctxWithBank(llm),
  )

  const prompt = prompts.evidenceCheck
  assert.ok(prompt, 'the evidence check was not called')
  assert.match(prompt, /# Workspace\nCompany: Datum \(datum\.example\.com\)/)
  assert.match(prompt, /# Evidence bank \(the only first-party facts you may state about Datum\)/)
  assert.match(prompt, /## Never state these/)
  // Every claim, including E1 which is cleared for web and blog only: the
  // auditor judges what was written, not what the writer was offered.
  for (const ref of ['[E1]', '[E2]', '[E3]', '[F4]', '[F5]', '[R6]']) {
    assert.ok(prompt.includes(ref), `${ref} missing from the evidence-check prompt`)
  }
  assert.match(
    prompt,
    /Refs the writer declared:\nE1 \(A reviewer approves the brief before drafting is paid for\.\)\nF4 \(Datum runs on Payload CMS and Postgres\.\)/,
  )
  assert.match(prompt, /Article "How to stream games":/)
  // The meta fields are audited too, and in the same block the reviewer gets.
  // A title tag is the shortest place in the article and the likeliest place
  // for an unbacked superlative to survive a careful body.
  assert.match(
    prompt,
    /Article "How to stream games":\n\nTitle tag: How to stream games\nMeta description: A short guide\.\nOG title: \(none\)\nOG description: \(none\)\n\n/,
  )
  assert.match(prompt, /FAQ entries \(structured data for search engines/)
  assert.match(systems.evidenceCheck, /You audit an article for first-party claims\./)
  assert.match(systems.evidenceCheck, /any statement about Datum, its product/)
  assert.match(systems.evidenceCheck, /"status": "backed"\|"overreach"\|"unbacked"\|"rejected"/)
})

test('a claim cited on a surface nobody cleared it for is reported as a clearance problem', async () => {
  // The check runs for `web`, and this claim is cleared for sales only. It is a
  // real entry with real proof behind it, so reporting it as an unknown ref
  // would send a reviewer hunting for a hallucination that is not there; the
  // finding has to name the actual problem.
  const salesOnly = {
    ...EVIDENCE_BANK_FIXTURE,
    verifiedClaims: EVIDENCE_BANK_FIXTURE.verifiedClaims.map((row) =>
      row.ref === 'E1' ? { ...row, clearedSurfaces: ['sales' as const] } : row,
    ),
  }
  const { llm } = capturingLlm()
  const base = ctxWithBank(llm)
  const outcome = await qaStage.run(
    citing(SOUND_BODY, [{ ref: 'E1', excerpt: 'A reviewer approves the brief.' }]),
    { ...base, tenant: { ...base.tenant, evidenceBank: salesOnly } } as StageContext,
  )

  const qa = (outcome.data as { qaResults: Record<string, Record<string, unknown>> }).qaResults
  const claims = qa.evidenceCheck.claims as { ref: string; status: string; note: string }[]
  const finding = claims.find((c) => c.ref === 'E1')
  assert.ok(finding, JSON.stringify(claims, null, 2))
  assert.equal(finding.status, 'unusable')
  assert.match(finding.note, /not cleared for web/)
  assert.equal(qa.evidenceCheck.passed, false)
})

test('the evidence check still runs for a workspace with no bank, and says so', async () => {
  const { llm, prompts } = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWith(llm))
  assert.match(
    prompts.evidenceCheck,
    /There is no evidence bank for this workspace, so every first-party claim is unbacked\./,
  )
  assert.match(prompts.evidenceCheck, /Refs the writer declared: none\./)
})

test('the fact check is untouched by the evidence bank', async () => {
  const withoutBank = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWith(withoutBank.llm))
  const withBank = capturingLlm()
  await qaStage.run(article('## Steps\nDo the thing.'), ctxWithBank(withBank.llm))

  assert.equal(withoutBank.prompts.factCheck, withBank.prompts.factCheck)
  assert.equal(withoutBank.systems.factCheck, withBank.systems.factCheck)
  assert.ok(!withBank.prompts.factCheck.includes('# Evidence bank'))
})

test('a rejected claim fails QA, and the failing excerpt reaches the stored notes', async () => {
  const llm: LlmClient = {
    async completeJSON(stage: LlmStage) {
      if (stage === 'evidenceCheck') {
        return {
          json: {
            claims: [
              {
                excerpt: 'Datum guarantees your articles will rank.',
                kind: 'first_party',
                status: 'rejected',
                ref: 'R6',
                note: 'Paraphrases a rejected claim.',
              },
            ],
            notes: 'One rejected claim.',
          },
          provider: 'mock',
          model: 'mock-evidence',
          usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
        }
      }
      return {
        json: { passed: true, notes: 'fine', sources: [] },
        provider: 'mock',
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      }
    },
  }
  const outcome = await qaStage.run(article(SOUND_BODY), ctxWithBank(llm))
  const qa = (outcome.data as { qaResults: Record<string, Record<string, unknown>> }).qaResults
  assert.equal(qa.structural.passed, true, 'nothing else is failing this draft')
  assert.equal(outcome.status, 'needs_revision')
  assert.equal(qa.evidenceCheck.passed, false)
  assert.match(String(qa.evidenceCheck.notes), /One rejected claim\./)
  // The replacement comes off the bank, not the model: it is only ever shown to
  // the model as prose inside the never-use list.
  assert.match(
    String(qa.evidenceCheck.notes),
    /Remove or replace: Datum guarantees your articles will rank\. \(rejected, use E1\)/,
  )
  assert.equal((qa.evidenceCheck.claims as unknown[]).length, 1)
  assert.equal(
    (outcome.data as { qaModels: Record<string, string> }).qaModels.evidenceCheck,
    'mock-evidence',
  )
})

test('an unbacked claim is recorded but does not fail the article', async () => {
  const llm: LlmClient = {
    async completeJSON(stage: LlmStage) {
      if (stage === 'evidenceCheck') {
        return {
          json: {
            claims: [
              { excerpt: 'We serve 312 teams.', kind: 'first_party', status: 'unbacked', ref: null, note: 'no entry' },
            ],
            notes: '',
          },
          provider: 'mock',
          model: 'mock-evidence',
          usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
        }
      }
      return {
        json: { passed: true, notes: 'fine', sources: [] },
        provider: 'mock',
        model: 'mock',
        usage: { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 },
      }
    },
  }
  const outcome = await qaStage.run(article(SOUND_BODY), ctxWithBank(llm))
  assert.equal(outcome.status, 'qa_passed')
  const qa = (outcome.data as { qaResults: Record<string, Record<string, unknown>> }).qaResults
  assert.equal(qa.evidenceCheck.passed, true)
  assert.equal((qa.evidenceCheck.claims as unknown[]).length, 1)
})

test('a declared ref the bank has never heard of fails on the deterministic half alone', async () => {
  const { llm } = capturingLlm()
  const outcome = await qaStage.run(
    citing(SOUND_BODY, [{ ref: 'E99', excerpt: 'We are the fastest.' }]),
    ctxWithBank(llm),
  )
  const qa = (outcome.data as { qaResults: Record<string, Record<string, unknown>> }).qaResults
  assert.equal(qa.structural.passed, true, 'nothing else is failing this draft')
  assert.equal(outcome.status, 'needs_revision')
  assert.equal(qa.evidenceCheck.passed, false)
  const claims = qa.evidenceCheck.claims as { status: string; ref: string }[]
  assert.deepEqual(claims, [
    {
      excerpt: '[E99]',
      kind: 'first_party',
      status: 'unusable',
      ref: 'E99',
      note: 'No such entry in the evidence bank.',
    },
  ])
})
