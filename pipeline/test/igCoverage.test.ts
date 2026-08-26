import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyTemplateHints,
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
    const claims = [{ internalDuplicateProbability: 0.9 }, { internalDuplicateProbability: 0.5 }]
    assert.equal(internalDuplicationRate(claims, 0.4), 1)
    assert.equal(internalDuplicationRate(claims, 0.95), 0)
  })

  it('is null when there are no claims', () => {
    assert.equal(internalDuplicationRate([]), null)
  })
})

describe('applyTemplateHints', () => {
  const hinted = (overrides: Partial<Facet> = {}): Facet =>
    facet({ mustHave: false, docCount: 4, weight: 1, ...overrides })

  it('flags a facet whose matchesHint is one of the headings', () => {
    const [result] = applyTemplateHints(
      [hinted({ matchesHint: 'Common mistakes' })],
      ['What you need', 'Common mistakes'],
      4,
    )
    assert.equal(result.mustHave, true)
  })

  it('flags a facet whose label is one of the headings', () => {
    const [result] = applyTemplateHints(
      [hinted({ label: 'Step-by-step instructions', matchesHint: null })],
      ['Step-by-step instructions'],
      4,
    )
    assert.equal(result.mustHave, true)
  })

  it('ignores case and surrounding whitespace on both sides', () => {
    const [result] = applyTemplateHints(
      [hinted({ label: 'x', matchesHint: '  COMMON   Mistakes ' })],
      ['  common   Mistakes'],
      4,
    )
    assert.equal(result.mustHave, true)
  })

  it('clears the flag on a facet the new template does not require', () => {
    const [result] = applyTemplateHints(
      [
        hinted({
          label: 'Pricing tiers',
          matchesHint: 'Pricing tiers',
          mustHave: true,
        }),
      ],
      ['What you need', 'FAQ'],
      4,
    )
    assert.equal(result.mustHave, false)
  })

  it('clears every flag when the template has no required sections', () => {
    const results = applyTemplateHints(
      [hinted({ matchesHint: 'FAQ', mustHave: true }), hinted({ label: 'FAQ', mustHave: true })],
      [],
      4,
    )
    assert.deepEqual(
      results.map((f) => f.mustHave),
      [false, false],
    )
  })

  it('does not treat a blank heading or a hintless facet as a match', () => {
    const [result] = applyTemplateHints([hinted({ label: '', matchesHint: '   ' })], ['   ', ''], 4)
    assert.equal(result.mustHave, false)
  })

  it('leaves docCount and every other field untouched', () => {
    const input = hinted({
      id: 'f3',
      label: 'Pricing tiers',
      description: 'What each tier costs.',
      weight: 0.25,
      docCount: 1,
      claimIds: ['b1-1'],
      matchesHint: 'Pricing tiers',
    })
    const [result] = applyTemplateHints([input], ['Pricing tiers'], 4)
    assert.deepEqual(
      { ...result, mustHave: false, weight: 0.25 },
      { ...input, mustHave: false, weight: 0.25 },
    )
    assert.equal(result.docCount, 1)
  })

  it('does not mutate the facets it is given', () => {
    const input = hinted({ matchesHint: 'FAQ', mustHave: true, weight: 1 })
    applyTemplateHints([input], ['What you need'], 4)
    assert.equal(input.mustHave, true)
    assert.equal(input.weight, 1)
  })

  // A facet's weight carries the mustHave floor, so re-deriving one without the
  // other would grade an article against a floor its template never asked for.
  it('drops the floor when a facet loses mustHave', () => {
    const [result] = applyTemplateHints(
      [
        hinted({
          label: 'Pricing tiers',
          matchesHint: 'Pricing tiers',
          mustHave: true,
          docCount: 1,
          weight: 1,
        }),
      ],
      ['FAQ'],
      4,
    )
    assert.equal(result.mustHave, false)
    assert.equal(result.weight, 0.25)
  })

  it('applies the floor when a facet gains mustHave', () => {
    const [result] = applyTemplateHints(
      [
        hinted({
          label: 'FAQ',
          matchesHint: null,
          mustHave: false,
          docCount: 1,
          weight: 0.25,
        }),
      ],
      ['FAQ'],
      4,
    )
    assert.equal(result.mustHave, true)
    assert.equal(result.weight, 1)
  })

  it('recomputes an unchanged facet to the same weight facetWeights would give it', () => {
    const unflagged = hinted({
      label: 'Pricing tiers',
      matchesHint: null,
      docCount: 3,
    })
    const flagged = hinted({
      label: 'FAQ',
      matchesHint: 'FAQ',
      mustHave: true,
      docCount: 1,
    })
    const results = applyTemplateHints([unflagged, flagged], ['FAQ'], 4)
    assert.deepEqual(
      results.map((f) => f.mustHave),
      [false, true],
    )
    assert.deepEqual(
      results.map((f) => f.weight),
      facetWeights(
        [
          { docCount: 3, mustHave: false },
          { docCount: 1, mustHave: true },
        ],
        4,
      ),
    )
    close(results[0].weight, 0.75)
    assert.equal(results[1].weight, 1)
  })

  it('weights every facet at 1 when totalDocs is 0, like facetWeights', () => {
    const results = applyTemplateHints(
      [hinted({ label: 'FAQ', docCount: 0 }), hinted({ label: 'Pricing tiers', docCount: 3 })],
      ['FAQ'],
      0,
    )
    assert.deepEqual(
      results.map((f) => f.weight),
      [1, 1],
    )
    assert.deepEqual(
      results.map((f) => f.weight),
      facetWeights(
        [
          { docCount: 0, mustHave: true },
          { docCount: 3, mustHave: false },
        ],
        0,
      ),
    )
  })

  it('treats a missing or negative docCount as zero', () => {
    const results = applyTemplateHints(
      [hinted({ label: 'a', docCount: -2 }), hinted({ label: 'b', docCount: Number.NaN })],
      [],
      4,
    )
    assert.deepEqual(
      results.map((f) => f.weight),
      [0, 0],
    )
  })
})
