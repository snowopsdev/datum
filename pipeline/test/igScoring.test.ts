import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clamp01,
  clampImportance,
  DEFAULT_POLICY,
  estimateTokens,
  FACET_GAIN_THRESHOLD,
  IMPORTANCE_RANGE,
  relevanceFromQueries,
  scoreClaim,
  scoreDocument,
  utilityFromRubric,
  UTILITY_WEIGHTS,
  type ClaimSignals,
  type Facet,
  type QueryClusterEntry,
} from '../src/informationGain/lib'

const close = (actual: number, expected: number, tolerance = 1e-3): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

const signals = (overrides: Partial<ClaimSignals> = {}): ClaimSignals => ({
  id: 'c1',
  kind: 'factual',
  importance: 1,
  novelty: 0,
  relevance: 1,
  utility: 1,
  intraDocumentNovelty: 1,
  evidenceSupport: 1,
  sourceQuality: 1,
  exactness: 1,
  contradictionProbability: 0,
  containsNumericOrTemporalClaim: false,
  verificationMode: 'verified',
  calibrated: false,
  ...overrides,
})

// The handoff §14 worked example: a well-known fact, a verified novel number,
// and a novel claim whose evidence does not hold up.
const claimA = signals({
  id: 'a',
  novelty: 0.08,
  relevance: 0.95,
  utility: 0.55,
  intraDocumentNovelty: 0.9,
  sourceQuality: 0.95,
})
const claimB = signals({
  id: 'b',
  importance: 2,
  novelty: 0.94,
  relevance: 0.98,
  utility: 0.95,
  intraDocumentNovelty: 0.95,
  sourceQuality: 0.96,
  containsNumericOrTemporalClaim: true,
})
const claimC = signals({
  id: 'c',
  novelty: 0.65,
  relevance: 0.92,
  utility: 0.5,
  intraDocumentNovelty: 0.95,
  evidenceSupport: 0.5,
  sourceQuality: 0.6,
})

describe('scoreClaim — handoff §14 worked example', () => {
  it('scores a familiar, well-supported claim as low gain', () => {
    const scored = scoreClaim(claimA, DEFAULT_POLICY)
    close(scored.potentialGain, 0.038)
    close(scored.verifiedGain, 0.036)
    close(scored.evidenceIntegrity, 0.95)
    assert.equal(scored.blocked, false)
    assert.equal(scored.requiresHumanReview, false)
    assert.deepEqual(scored.reasons, [])
  })

  it('scores a novel, well-supported numeric claim as high gain', () => {
    const scored = scoreClaim(claimB, DEFAULT_POLICY)
    close(scored.potentialGain, 0.831)
    close(scored.verifiedGain, 0.798)
    close(scored.evidenceIntegrity, 0.96)
    assert.equal(scored.blocked, false)
    assert.deepEqual(scored.reasons, [])
  })

  it('blocks a novel claim whose evidence integrity is below the factual floor', () => {
    const scored = scoreClaim(claimC, DEFAULT_POLICY)
    close(scored.potentialGain, 0.284)
    assert.equal(scored.blocked, true)
    assert.equal(scored.verifiedGain, 0)
    assert.equal(scored.reasons.length, 1)
    assert.equal(scored.reasons[0].policy, 'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT')
    assert.equal(scored.reasons[0].severity, 'BLOCK')
    assert.equal(scored.reasons[0].claimId, 'c')
    assert.equal(scored.reasons[0].message, 'Evidence integrity was 0.30; minimum is 0.90.')
  })
})

describe('scoreClaim — policy gates', () => {
  it('blocks a materially novel numeric claim whose values do not match exactly', () => {
    const scored = scoreClaim(
      signals({ id: 'n1', novelty: 0.9, containsNumericOrTemporalClaim: true, exactness: 0.99 }),
      DEFAULT_POLICY,
    )
    assert.equal(scored.blocked, true)
    assert.equal(scored.verifiedGain, 0)
    assert.equal(scored.reasons[0].policy, 'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT')
    assert.equal(
      scored.reasons[0].message,
      'Numeric or temporal values do not exactly match the evidence.',
    )
  })

  it('reports a numeric block under the numeric code even when integrity is what fails', () => {
    const scored = scoreClaim(
      signals({ id: 'n2', novelty: 0.9, containsNumericOrTemporalClaim: true, exactness: 0.9 }),
      DEFAULT_POLICY,
    )
    assert.equal(scored.blocked, true)
    assert.equal(scored.reasons[0].policy, 'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT')
    assert.equal(scored.reasons[0].message, 'Evidence integrity was 0.90; minimum is 0.95.')
  })

  it('does not block on exactness when requireExactValueMatch is off', () => {
    const scored = scoreClaim(
      signals({ id: 'n3', novelty: 0.9, containsNumericOrTemporalClaim: true, exactness: 0.99 }),
      { ...DEFAULT_POLICY, requireExactValueMatch: false },
    )
    assert.equal(scored.blocked, false)
    close(scored.verifiedGain, 0.9 * 0.99, 1e-9)
  })

  it('holds a first-party measurement to the numeric integrity floor', () => {
    const floorFail = scoreClaim(
      signals({ id: 'f1', kind: 'first_party_measurement', novelty: 0.9, sourceQuality: 0.93 }),
      DEFAULT_POLICY,
    )
    assert.equal(floorFail.blocked, true)
    const floorPass = scoreClaim(
      signals({ id: 'f2', kind: 'first_party_measurement', novelty: 0.9 }),
      DEFAULT_POLICY,
    )
    assert.equal(floorPass.blocked, false)
  })

  it('sends a materially novel inference to human review', () => {
    const inference = signals({ id: 'i1', kind: 'inference', novelty: 0.6 })
    const scored = scoreClaim(inference, DEFAULT_POLICY)
    assert.equal(scored.requiresHumanReview, true)
    assert.equal(scored.blocked, false)
    const codes = scored.reasons.map((r) => r.policy)
    assert.deepEqual(codes, ['NOVEL_INFERENCE_REQUIRES_REVIEW'])
    assert.equal(scored.reasons[0].severity, 'HUMAN_REVIEW')
    assert.equal(scored.reasons[0].message, 'Materially novel inference requires human review.')
  })

  it('leaves a barely novel inference alone', () => {
    const inference = signals({ id: 'i2', kind: 'inference', novelty: 0.5 })
    const scored = scoreClaim(inference, DEFAULT_POLICY)
    assert.equal(scored.requiresHumanReview, false)
    assert.deepEqual(scored.reasons, [])
  })

  it('sends a contradicting claim to human review', () => {
    const scored = scoreClaim(
      signals({ id: 'x1', novelty: 0.2, contradictionProbability: 0.3 }),
      DEFAULT_POLICY,
    )
    assert.equal(scored.requiresHumanReview, true)
    assert.equal(scored.reasons[0].policy, 'CONTRADICTION_REQUIRES_REVIEW')
    assert.equal(scored.reasons[0].severity, 'HUMAN_REVIEW')
    assert.equal(scored.reasons[0].message, 'Contradiction probability was 0.30; maximum is 0.25.')
  })

  it('never blocks a claim that was not independently verified', () => {
    const modes = ['baseline_corroborated', 'skipped_no_baseline', 'not_applicable'] as const
    for (const verificationMode of modes) {
      const scored = scoreClaim({ ...claimC, verificationMode }, DEFAULT_POLICY)
      assert.equal(scored.blocked, false, verificationMode)
      close(scored.verifiedGain, 0.284 * 0.3, 1e-3)
    }
  })

  it('clamps out-of-range signals instead of throwing', () => {
    const scored = scoreClaim(
      signals({ id: 'w1', novelty: 5, relevance: -1, utility: Number.NaN, exactness: 2 }),
      DEFAULT_POLICY,
    )
    assert.equal(scored.potentialGain, 0)
    assert.equal(scored.verifiedGain, 0)
  })
})

describe('scoreDocument', () => {
  const claims = [claimA, claimB, claimC]

  it('aggregates importance-weighted gain units', () => {
    const doc = scoreDocument(claims, 2000, DEFAULT_POLICY, [], () => null)
    close(doc.potentialGainUnits, 1.9844)
    close(doc.verifiedGainUnits, 1.632)
    close(doc.verificationRatio, 0.8224)
    close(doc.verifiedGainDensity, 0.816)
    assert.equal(doc.facetGainCoverage, null)
    assert.deepEqual(doc.blockedClaimIds, ['c'])
    assert.deepEqual(doc.reviewClaimIds, [])
    assert.deepEqual(doc.materiallyNovelClaimIds, ['b', 'c'])
    assert.deepEqual(doc.verifiedNovelClaimIds, ['b'])
  })

  it('computes weighted facet gain coverage', () => {
    const facets: Facet[] = [
      {
        id: 'f1',
        label: 'Pricing',
        description: 'What it costs',
        weight: 3,
        docCount: 4,
        mustHave: true,
        claimIds: ['b'],
      },
      {
        id: 'f2',
        label: 'Limits',
        description: 'Rate limits',
        weight: 1,
        docCount: 2,
        mustHave: false,
        claimIds: ['c'],
      },
    ]
    const facetOf = (id: string): string | null => (id === 'b' ? 'f1' : id === 'c' ? 'f2' : null)
    const doc = scoreDocument(claims, 2000, DEFAULT_POLICY, facets, facetOf)
    // f1 is carried by claim b (verified gain 0.798); f2's only claim is blocked.
    close(doc.facetGainCoverage ?? -1, 0.75)
  })

  it('never divides by a zero or non-finite token count', () => {
    const doc = scoreDocument(claims, 0, DEFAULT_POLICY, [], () => null)
    assert.ok(Number.isFinite(doc.verifiedGainDensity))
    close(doc.verifiedGainDensity, 1632, 0.1)
    const nan = scoreDocument(claims, Number.NaN, DEFAULT_POLICY, [], () => null)
    assert.ok(Number.isFinite(nan.verifiedGainDensity))
  })

  it('reports a zero verification ratio when there is no potential gain', () => {
    const doc = scoreDocument([], 1000, DEFAULT_POLICY, [], () => null)
    assert.equal(doc.potentialGainUnits, 0)
    assert.equal(doc.verificationRatio, 0)
    assert.equal(doc.verifiedGainDensity, 0)
  })
})

describe('scoring helpers', () => {
  it('clamps 0–1 signals and importance', () => {
    assert.equal(clamp01(0.5), 0.5)
    assert.equal(clamp01(-1), 0)
    assert.equal(clamp01(2), 1)
    assert.equal(clamp01(Number.NaN), 0)
    assert.equal(clampImportance(1.5), 1.5)
    assert.equal(clampImportance(9), IMPORTANCE_RANGE.max)
    assert.equal(clampImportance(0), IMPORTANCE_RANGE.min)
    assert.equal(clampImportance(Number.POSITIVE_INFINITY), IMPORTANCE_RANGE.min)
  })

  it('weights the utility rubric so a perfect rubric scores 1', () => {
    const weights = Object.values(UTILITY_WEIGHTS).reduce((a, b) => a + b, 0)
    close(weights, 1, 1e-9)
    close(
      utilityFromRubric({ specificity: 1, actionability: 1, explanatoryPower: 1, audienceFit: 1 }),
      1,
      1e-9,
    )
    close(
      utilityFromRubric({ specificity: 1, actionability: 0, explanatoryPower: 0, audienceFit: 0 }),
      UTILITY_WEIGHTS.specificity,
      1e-9,
    )
    close(
      utilityFromRubric({ specificity: 5, actionability: -2, explanatoryPower: 0, audienceFit: 0 }),
      UTILITY_WEIGHTS.specificity,
      1e-9,
    )
  })

  it('weights relevance across the query cluster, counting missing queries as zero', () => {
    const cluster: QueryClusterEntry[] = [
      { id: 'q1', text: 'best crm', kind: 'keyword', weight: 0.6 },
      { id: 'q2', text: 'how much does a crm cost', kind: 'related_question', weight: 0.4 },
    ]
    close(relevanceFromQueries({ q1: 0.5 }, cluster), 0.3, 1e-9)
    close(relevanceFromQueries({ q1: 1, q2: 1 }, cluster), 1, 1e-9)
    close(relevanceFromQueries({}, cluster), 0, 1e-9)
    close(relevanceFromQueries({ q1: 0.5 }, []), 0, 1e-9)
  })

  it('estimates tokens from whitespace-separated words', () => {
    assert.equal(estimateTokens('a b c'), 4)
    assert.equal(estimateTokens(''), 1)
    assert.equal(estimateTokens('   '), 1)
    assert.equal(estimateTokens('one'), 2)
    assert.equal(estimateTokens('a\nb\tc  d'), 6)
  })

  it('exposes the facet gain threshold', () => {
    assert.equal(FACET_GAIN_THRESHOLD, 0.1)
  })
})
