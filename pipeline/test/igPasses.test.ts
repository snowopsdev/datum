import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payload } from 'payload'

import { judgeBatches, verifierBatches } from '../src/informationGain/batching'
import { DEFAULT_POLICY, type DraftClaim } from '../src/informationGain/lib'
import { runJudge, runVerifier } from '../src/informationGain/passes'
import type { LlmClient } from '../src/llm'
import type { StageContext } from '../src/stages'

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

function harness() {
  let active = 0
  let peak = 0
  let call = 0
  const finished: string[] = []
  const costs: string[] = []
  const llm: LlmClient = {
    async completeJSON(_stage, request, model) {
      const ids = [...request.user.matchAll(/"id"\s*:\s*"(c\d+)"/g)].map((match) => match[1])
      const index = call++
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, index % 3 === 0 ? 40 : 5))
      active--
      finished.push(ids[0])
      return {
        model,
        provider: 'mock',
        usage: { inputTokens: 1, outputTokens: 1, webSearchRequests: 0 },
        json: {
          claims: ids.map((id) => ({
            claimId: id,
            duplicateProbability: 0,
            internalDuplicateProbability: 0,
            relevanceByQuery: {},
            utility: {},
            importance: 1,
            rationale: id,
            support: 0,
            contradiction: 0,
            evidence: [],
            notes: id,
          })),
        },
      }
    },
  }
  const payload = {
    async create({
      collection,
      data,
    }: {
      collection: string
      data: { response: { claims: { claimId: string }[] } }
    }) {
      assert.equal(collection, 'cost-log')
      costs.push(data.response.claims[0].claimId)
      return { id: costs.length }
    },
  } as unknown as Payload
  const ctx = {
    payload,
    llm,
    runId: 'bounded-passes',
    models: { informationGainJudge: 'mock', evidenceVerification: 'mock' },
    evidenceSources: [],
  } as unknown as StageContext
  return { ctx, finished, costs, peak: () => peak }
}

test('judge batches merge in input order with at most three calls in flight', async () => {
  const h = harness()
  const judged = await runJudge(h.ctx, 1, 'topic', [], [], claims, [])
  assert.deepEqual(
    [...judged.keys()],
    claims.map((claim) => claim.id),
  )
  assert.equal(h.peak(), 3)
  assert.notDeepEqual(
    h.finished,
    judgeBatches(claims).map((batch) => batch[0].id),
  )
  assert.deepEqual(h.costs, h.finished)
})

test('verifier batches merge in input order with at most three calls in flight', async () => {
  const h = harness()
  const judged = await runJudge(h.ctx, 1, 'topic', [], [], claims, [])
  h.finished.length = 0
  h.costs.length = 0
  const outcomes = await runVerifier(h.ctx, 1, 'topic', claims, judged, DEFAULT_POLICY)
  assert.deepEqual(
    [...outcomes.keys()],
    claims.map((claim) => claim.id),
  )
  assert.equal(h.peak(), 3)
  assert.notDeepEqual(
    h.finished,
    verifierBatches(claims).map((batch) => batch[0].id),
  )
  assert.deepEqual(h.costs, h.finished)
})
