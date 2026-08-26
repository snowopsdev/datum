import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  consensusCoverage,
  facetWeights,
  internalDuplicationRate,
  type Facet,
} from '../src/informationGain/lib'

const close = (actual: number, expected: number, tolerance = 1e-9): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

const facet = (overrides: Partial<Facet> = {}): Facet => ({
  id: 'f1',
  label: 'Facet',
  description: '',
  weight: 1,
  docCount: 0,
  mustHave: false,
  claimIds: [],
  ...overrides,
})

describe('facetWeights', () => {
  it('weights a facet by the share of baseline documents that cover it', () => {
    assert.deepEqual(
      facetWeights(
        [
          { docCount: 5, mustHave: false },
          { docCount: 10, mustHave: false },
        ],
        10,
      ),
      [0.5, 1],
    )
  })

  it('floors a must-have facet at 1 even when few documents cover it', () => {
    assert.deepEqual(facetWeights([{ docCount: 1, mustHave: true }], 10), [1])
  })

  it('does not lower a must-have facet that already weighs more than 1', () => {
    assert.deepEqual(facetWeights([{ docCount: 20, mustHave: true }], 10), [2])
  })

  it('falls back to 1 for every facet when the document count is unusable', () => {
    const facets = [
      { docCount: 5, mustHave: false },
      { docCount: 0, mustHave: false },
    ]
    assert.deepEqual(facetWeights(facets, 0), [1, 1])
    assert.deepEqual(facetWeights(facets, -3), [1, 1])
  })

  it('returns an empty array for no facets', () => {
    assert.deepEqual(facetWeights([], 10), [])
  })
})

describe('consensusCoverage', () => {
  it('is the weighted share of facets some claim addresses', () => {
    const facets = [facet({ id: 'a', weight: 0.5 }), facet({ id: 'b', weight: 1 })]
    close(consensusCoverage(facets, [{ facetId: 'b' }]) as number, 1 / 1.5)
    close(consensusCoverage(facets, [{ facetId: 'a' }]) as number, 0.5 / 1.5)
    close(consensusCoverage(facets, [{ facetId: 'a' }, { facetId: 'b' }]) as number, 1)
  })

  it('is 0 when no claim maps to any facet', () => {
    const facets = [facet({ id: 'a', weight: 0.5 }), facet({ id: 'b', weight: 1 })]
    assert.equal(consensusCoverage(facets, [{ facetId: null }, { facetId: 'zz' }]), 0)
  })

  it('counts a facet once no matter how many claims cover it', () => {
    const facets = [facet({ id: 'a', weight: 0.5 }), facet({ id: 'b', weight: 1 })]
    close(consensusCoverage(facets, [{ facetId: 'b' }, { facetId: 'b' }]) as number, 1 / 1.5)
  })

  it('is null when there are no facets', () => {
    assert.equal(consensusCoverage([], [{ facetId: 'a' }]), null)
  })

  it('is null when the facet weights sum to nothing', () => {
    assert.equal(consensusCoverage([facet({ id: 'a', weight: 0 })], [{ facetId: 'a' }]), null)
  })
})

describe('internalDuplicationRate', () => {
  it('is the share of claims at or above the threshold', () => {
    const claims = [
      { internalDuplicateProbability: 0.9 },
      { internalDuplicateProbability: 0.8 },
      { internalDuplicateProbability: 0.79 },
      { internalDuplicateProbability: 0 },
    ]
    assert.equal(internalDuplicationRate(claims), 0.5)
  })

  it('honours a custom threshold', () => {
    const claims = [
      { internalDuplicateProbability: 0.9 },
      { internalDuplicateProbability: 0.5 },
    ]
    assert.equal(internalDuplicationRate(claims, 0.4), 1)
    assert.equal(internalDuplicationRate(claims, 0.95), 0)
  })

  it('is null when there are no claims', () => {
    assert.equal(internalDuplicationRate([]), null)
  })
})
