import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payload } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'
import type { SerpResearch } from '../src/ahrefs'
import { config } from '../src/config'
// Initialise the stage registry before its circular QA dependency.
import { stages, type StageContext } from '../src/stages'
import { getOrBuildSnapshot } from '../src/corpus/snapshot'
import { mockFixture } from '../src/fixtures'
import { DEFAULT_POLICY, type DraftClaim } from '../src/informationGain/lib'
import { runJudge, runVerifier } from '../src/informationGain/passes'
import type { JudgeDerived } from '../src/informationGain/scorecard'
import type { LlmClient } from '../src/llm'
import { loadStyleGuide } from '../src/styleGuide'
import { emptyTenantContext } from '../src/tenant'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((release) => {
    resolve = release
  })
  return { promise, resolve }
}

const article = {
  id: 1,
  keyword: 'stream games',
  title: 'Stream games',
  status: 'drafted',
  template: { id: 1, name: 'How-To' } as Template,
} as Article

const claims: DraftClaim[] = Array.from({ length: 65 }, (_, index) => ({
  id: `c${index + 1}`,
  text: `Specific factual claim ${index + 1}`,
  type: 'factual',
  excerpt: `Specific factual claim ${index + 1}`,
  section: null,
  facetId: null,
  entities: [],
  values: [],
  restatesClaimId: null,
  excerptFound: true,
}))

/** Hold successful provider replies and their separate database writes open. */
function harness(internal = false) {
  const replies = deferred()
  const writes = deferred()
  const failure = new Error('fast LLM failure')
  const started: string[] = []
  const finished: string[] = []
  const costs: string[] = []
  let costWrites = 0
  const llm: LlmClient = {
    async completeJSON(stage, request, model) {
      const index = started.length
      started.push(stage)
      if (index === 1) throw failure
      await replies.promise
      finished.push(stage)
      return {
        model,
        provider: 'mock',
        usage: { inputTokens: 1, outputTokens: 1, webSearchRequests: 0 },
        json:
          stage === 'claimExtraction'
            ? mockFixture(stage, request.fixtureKey)
            : { passed: true, notes: 'fine', sources: [], claims: [] },
      }
    },
  }
  const docs = Array.from({ length: 5 }, (_, index) => ({
    id: index + 10,
    keyword: article.keyword,
    title: article.title,
    updatedAt: '2026-10-06T00:00:00.000Z',
  }))
  const payload = {
    async find({ collection }: { collection: string }) {
      return { docs: internal && collection === 'articles' ? docs : [] }
    },
    async create({ collection, data }: { collection: string; data: { stage: string } }) {
      assert.equal(collection, 'cost-log', 'failed snapshot must not be persisted')
      costWrites++
      await writes.promise
      costs.push(data.stage)
      return { id: costs.length }
    },
  } as unknown as Payload
  const ctx = {
    payload,
    llm,
    mode: 'mock',
    runId: 'settlement-test',
    tenant: emptyTenantContext(),
    styleGuide: loadStyleGuide(),
    brandVoice: null,
    models: {
      factCheck: 'mock',
      qualitativeReview: 'mock',
      evidenceCheck: 'mock',
      informationGainJudge: 'mock',
      evidenceVerification: 'mock',
      claimExtraction: 'mock',
    },
    evidenceSources: [],
  } as unknown as StageContext
  return {
    ctx,
    replies,
    writes,
    failure,
    started,
    finished,
    costs,
    costWrites: () => costWrites,
  }
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve))

async function assertDrains(run: (ctx: StageContext) => Promise<unknown>, internal = false) {
  const h = harness(internal)
  let settled = false
  const pending = run(h.ctx).then(
    () => {
      settled = true
      assert.fail('expected failure')
    },
    (error: unknown) => {
      settled = true
      return error
    },
  )
  try {
    await turn()
    assert.equal(h.started.length, 3)
    assert.equal(settled, false, 'must wait for sibling provider replies')
    h.replies.resolve()
    await turn()
    assert.equal(h.finished.length, 2)
    assert.equal(h.costWrites(), 2)
    assert.deepEqual(h.costs, [])
    assert.equal(settled, false, 'must also wait for cost persistence')
    assert.equal(h.started.length, 3, 'must not start another batch after failure')
  } finally {
    h.replies.resolve()
    h.writes.resolve()
    assert.equal(await pending, h.failure)
  }
  assert.deepEqual(h.costs, h.finished)
  assert.equal(h.started.length, 3)
}

test('QA drains sibling LLM calls and cost writes before rejecting', async () => {
  await assertDrains((ctx) => stages.find((stage) => stage.name === 'qa')!.run(article, ctx))
})

test('judge drains sibling LLM calls and cost writes without starting later batches', async () => {
  await assertDrains((ctx) => runJudge(ctx, article.id, article.keyword, [], [], claims, []))
})

test('verifier drains sibling LLM calls and cost writes without starting later batches', async () => {
  const judged = new Map(claims.map((claim) => [claim.id, { novelty: 1 } as JudgeDerived]))
  await assertDrains((ctx) =>
    runVerifier(ctx, article.id, article.keyword, claims, judged, DEFAULT_POLICY),
  )
})

for (const internal of [false, true]) {
  test(`${internal ? 'internal' : 'SERP'} corpus extraction drains LLM calls and cost writes`, async () => {
    assert.equal(config.mockMode, true, 'corpus test must never crawl live pages')
    const serp = {
      pages: internal
        ? []
        : Array.from({ length: 5 }, (_, index) => ({
            position: index + 1,
            url: `https://example.com/page-${index + 1}`,
            title: 'Stream games',
          })),
    } as SerpResearch
    await assertDrains(
      (ctx) => getOrBuildSnapshot(ctx, article, article.template as Template, serp, []),
      internal,
    )
  })
}
