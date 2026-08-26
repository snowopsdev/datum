import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  groupClaimsByFacet,
  intraDocumentNovelty,
  judgeBatches,
  pickForVerification,
  selectBaselineContext,
  verifierBatches,
  OTHER_FACET_KEY,
} from '../src/informationGain/batching'
import { DEFAULT_POLICY, type BaselineClaim, type DraftClaim } from '../src/informationGain/lib'

const draft = (id: string, over: Partial<DraftClaim> = {}): DraftClaim => ({
  id,
  text: `claim ${id}`,
  type: 'factual',
  excerpt: `claim ${id}`,
  section: null,
  facetId: null,
  entities: [],
  values: [],
  restatesClaimId: null,
  excerptFound: true,
  ...over,
})

const baseline = (id: string, over: Partial<BaselineClaim> = {}): BaselineClaim => ({
  id,
  text: `baseline ${id}`,
  type: 'factual',
  excerpt: `baseline ${id}`,
  entities: [],
  values: [],
  source: { kind: 'serp', docId: 'serp:1' },
  facetId: null,
  ...over,
})

const ids = (claims: DraftClaim[]): string[] => claims.map((claim) => claim.id)
const baselineIds = (claims: BaselineClaim[]): string[] => claims.map((claim) => claim.id)

describe('groupClaimsByFacet', () => {
  it('groups by facet id and files unassigned claims under "other"', () => {
    const groups = groupClaimsByFacet([
      draft('c001', { facetId: 'f1' }),
      draft('c002', { facetId: null }),
      draft('c003', { facetId: 'f1' }),
      draft('c004', { facetId: 'f2' }),
    ])

    assert.deepEqual([...groups.keys()], ['f1', OTHER_FACET_KEY, 'f2'])
    assert.deepEqual(ids(groups.get('f1') ?? []), ['c001', 'c003'])
    assert.deepEqual(ids(groups.get(OTHER_FACET_KEY) ?? []), ['c002'])
    assert.deepEqual(ids(groups.get('f2') ?? []), ['c004'])
  })

  it('keys facets in first-appearance order and keeps document order inside each', () => {
    const groups = groupClaimsByFacet([
      draft('c001', { facetId: 'f9' }),
      draft('c002', { facetId: 'f2' }),
      draft('c003', { facetId: 'f9' }),
    ])
    assert.deepEqual([...groups.keys()], ['f9', 'f2'])
    assert.deepEqual(ids(groups.get('f9') ?? []), ['c001', 'c003'])
  })

  it('returns an empty map for no claims', () => {
    assert.equal(groupClaimsByFacet([]).size, 0)
  })
})

describe('judgeBatches', () => {
  it('caps a batch at 12 claims and splits a larger facet in document order', () => {
    const claims = Array.from({ length: 13 }, (_, index) =>
      draft(`c${String(index + 1).padStart(3, '0')}`, { facetId: 'f1' }),
    )
    const batches = judgeBatches(claims)

    assert.equal(batches.length, 2)
    assert.equal(batches[0].length, 12)
    assert.deepEqual(ids(batches[1]), ['c013'])
  })

  it('never mixes facets in one batch and orders batches by first appearance', () => {
    const batches = judgeBatches([
      draft('c001', { facetId: 'f2' }),
      draft('c002', { facetId: null }),
      draft('c003', { facetId: 'f1' }),
      draft('c004', { facetId: 'f2' }),
    ])

    assert.deepEqual(batches.map(ids), [['c001', 'c004'], ['c002'], ['c003']])
  })

  it('is deterministic: the same claims always batch the same way', () => {
    const claims = [
      draft('c001', { facetId: 'f1' }),
      draft('c002', { facetId: 'f2' }),
      draft('c003', { facetId: 'f1' }),
    ]
    assert.deepEqual(judgeBatches(claims).map(ids), judgeBatches(claims).map(ids))
  })

  it('honours an explicit batch size and returns nothing for no claims', () => {
    const claims = Array.from({ length: 5 }, (_, index) =>
      draft(`c00${index + 1}`, { facetId: 'f1' }),
    )
    assert.deepEqual(judgeBatches(claims, { maxPerBatch: 2 }).map(ids), [
      ['c001', 'c002'],
      ['c003', 'c004'],
      ['c005'],
    ])
    assert.deepEqual(judgeBatches([]), [])
  })
})

describe('selectBaselineContext', () => {
  const batch = [draft('c001', { facetId: 'f1' }), draft('c002', { facetId: 'f1' })]

  it('keeps only same-facet baseline claims, SERP first then internal', () => {
    const context = selectBaselineContext(batch, [
      baseline('b1-1', { facetId: 'f2' }),
      baseline('a1-1', {
        facetId: 'f1',
        source: { kind: 'internal', docId: 'internal:7', articleId: 7 },
      }),
      baseline('b1-2', { facetId: 'f1' }),
      baseline('b1-3', { facetId: null }),
    ])

    assert.deepEqual(baselineIds(context), ['b1-2', 'a1-1'])
  })

  it('orders SERP claims by page position, whatever order they arrive in', () => {
    const context = selectBaselineContext(batch, [
      baseline('b3-1', { facetId: 'f1', source: { kind: 'serp', docId: 'serp:3' } }),
      baseline('b1-1', { facetId: 'f1', source: { kind: 'serp', docId: 'serp:1' } }),
      baseline('b2-1', { facetId: 'f1', source: { kind: 'serp', docId: 'serp:2' } }),
      baseline('b1-2', { facetId: 'f1', source: { kind: 'serp', docId: 'serp:1' } }),
    ])

    assert.deepEqual(baselineIds(context), ['b1-1', 'b1-2', 'b2-1', 'b3-1'])
  })

  it('sorts SERP claims whose docId names no position last, in arrival order', () => {
    const context = selectBaselineContext(batch, [
      baseline('x-1', { facetId: 'f1', source: { kind: 'serp', docId: 'legacy' } }),
      baseline('x-2', { facetId: 'f1', source: { kind: 'serp', docId: 'legacy' } }),
      baseline('b2-1', { facetId: 'f1', source: { kind: 'serp', docId: 'serp:2' } }),
    ])

    assert.deepEqual(baselineIds(context), ['b2-1', 'x-1', 'x-2'])
  })

  it('caps same-facet SERP claims at 50 and internal claims at 20', () => {
    const serp = Array.from({ length: 60 }, (_, index) =>
      baseline(`b1-${index + 1}`, { facetId: 'f1' }),
    )
    const internal = Array.from({ length: 25 }, (_, index) =>
      baseline(`a1-${index + 1}`, {
        facetId: 'f1',
        source: { kind: 'internal', docId: 'internal:1', articleId: 1 },
      }),
    )

    const context = selectBaselineContext(batch, [...serp, ...internal])
    assert.equal(context.filter((claim) => claim.source.kind === 'serp').length, 50)
    assert.equal(context.filter((claim) => claim.source.kind === 'internal').length, 20)
    assert.equal(context[0].id, 'b1-1')
    assert.equal(context[49].id, 'b1-50')
    assert.equal(context[50].id, 'a1-1')
  })

  it('ranks the "other" bucket by token overlap with the batch text, capped at 40', () => {
    const otherBatch = [draft('c001', { text: 'Burr grinder calibration changes espresso yield.' })]
    const noise = Array.from({ length: 45 }, (_, index) =>
      baseline(`n${index + 1}`, { text: 'Unrelated sentence about knitting patterns.' }),
    )
    const context = selectBaselineContext(otherBatch, [
      ...noise,
      baseline('hit-1', { text: 'Grinder calibration drives espresso yield more than anything.' }),
      baseline('hit-2', { text: 'Espresso yield depends on the burr grinder.' }),
      baseline('hit-3', { text: 'Espresso needs a scale.' }),
    ])

    assert.equal(context.length, 40)
    assert.deepEqual(baselineIds(context).slice(0, 3), ['hit-1', 'hit-2', 'hit-3'])
  })

  it('ranks by overlap for a batch whose claims disagree about their facet', () => {
    const mixed = [draft('c001', { facetId: 'f1' }), draft('c002', { facetId: 'f2' })]
    const context = selectBaselineContext(mixed, [
      baseline('b1-1', { facetId: 'f2', text: 'claim c001 restated' }),
      baseline('b1-2', { facetId: 'f1', text: 'nothing in common whatsoever' }),
    ])

    assert.deepEqual(baselineIds(context), ['b1-1', 'b1-2'])
  })

  it('breaks overlap ties on the order the claims arrived in', () => {
    const otherBatch = [draft('c001', { text: 'espresso grinder' })]
    const context = selectBaselineContext(otherBatch, [
      baseline('b1-1', { text: 'espresso grinder' }),
      baseline('b1-2', { text: 'espresso grinder' }),
    ])
    assert.deepEqual(baselineIds(context), ['b1-1', 'b1-2'])
  })

  it('honours explicit caps', () => {
    const serp = Array.from({ length: 5 }, (_, index) =>
      baseline(`b1-${index + 1}`, { facetId: 'f1' }),
    )
    const context = selectBaselineContext(batch, serp, { serpCap: 2 })
    assert.deepEqual(baselineIds(context), ['b1-1', 'b1-2'])
  })
})

describe('pickForVerification', () => {
  const threshold = DEFAULT_POLICY.materialNoveltyThreshold

  it('keeps verifiable claims at or above the material-novelty threshold', () => {
    const picked = pickForVerification(
      [
        { claim: draft('c001', { type: 'factual' }), novelty: threshold },
        { claim: draft('c002', { type: 'factual' }), novelty: threshold - 0.01 },
        { claim: draft('c003', { type: 'inference' }), novelty: 0.9 },
        { claim: draft('c004', { type: 'opinion' }), novelty: 1 },
        { claim: draft('c005', { type: 'recommendation' }), novelty: 1 },
      ],
      DEFAULT_POLICY,
    )

    assert.deepEqual(ids(picked), ['c001', 'c003'])
  })

  it('includes first-party measurements so the reviewer sees the evidence', () => {
    const picked = pickForVerification(
      [{ claim: draft('c001', { type: 'first_party_measurement' }), novelty: 0.9 }],
      DEFAULT_POLICY,
    )
    assert.deepEqual(ids(picked), ['c001'])
  })

  it('preserves document order and returns nothing when no claim qualifies', () => {
    const picked = pickForVerification(
      [
        { claim: draft('c003'), novelty: 0.9 },
        { claim: draft('c001'), novelty: 0.8 },
      ],
      DEFAULT_POLICY,
    )
    assert.deepEqual(ids(picked), ['c003', 'c001'])
    assert.deepEqual(pickForVerification([], DEFAULT_POLICY), [])
  })
})

describe('verifierBatches', () => {
  it('chunks claims into batches of five in order', () => {
    const claims = Array.from({ length: 11 }, (_, index) =>
      draft(`c${String(index + 1).padStart(3, '0')}`),
    )
    const batches = verifierBatches(claims)

    assert.deepEqual(
      batches.map((batch) => batch.length),
      [5, 5, 1],
    )
    assert.deepEqual(ids(batches[2]), ['c011'])
    assert.deepEqual(verifierBatches([]), [])
  })
})

describe('intraDocumentNovelty', () => {
  it('is 1 for a claim that says something new', () => {
    const claim = draft('c002', { text: 'Backflush the machine weekly with plain water.' })
    const earlier = [draft('c001', { text: 'A first setup costs $500 to $1,500.' })]
    assert.equal(intraDocumentNovelty(claim, earlier), 1)
  })

  it('is 0.2 when the claim restates an earlier one', () => {
    const claim = draft('c002', {
      text: 'Plan on $500 to $1,500 in total.',
      restatesClaimId: 'c001',
    })
    const earlier = [draft('c001', { text: 'A first setup costs between $500 and $1,500.' })]
    assert.equal(intraDocumentNovelty(claim, earlier), 0.2)
  })

  it('ignores a restatement pointer that names no earlier claim', () => {
    const claim = draft('c002', { text: 'Something entirely else.', restatesClaimId: 'c009' })
    assert.equal(intraDocumentNovelty(claim, [draft('c001', { text: 'Unrelated wording.' })]), 1)
  })

  it('is 0 for a near-duplicate of an earlier claim', () => {
    const claim = draft('c002', { text: 'Backflush the machine weekly with plain water.' })
    const earlier = [draft('c001', { text: 'Backflush the machine weekly with plain water.' })]
    assert.equal(intraDocumentNovelty(claim, earlier), 0)
  })

  it('lets the near-duplicate penalty win over the restatement penalty', () => {
    const claim = draft('c002', {
      text: 'Backflush the machine weekly with plain water.',
      restatesClaimId: 'c001',
    })
    const earlier = [draft('c001', { text: 'Backflush the machine weekly with plain water.' })]
    assert.equal(intraDocumentNovelty(claim, earlier), 0)
  })

  it('is 1 for the first claim in a draft', () => {
    assert.equal(intraDocumentNovelty(draft('c001'), []), 1)
  })
})
