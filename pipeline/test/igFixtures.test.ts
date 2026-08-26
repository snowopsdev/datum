import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { intraDocumentNovelty } from '../src/informationGain/batching'
import {
  compareValues,
  extractValues,
  parseDraftClaims,
  parseJudgeReply,
  parseVerifierReply,
  DEFAULT_POLICY,
  type DraftClaim,
} from '../src/informationGain/lib'
import { mockFixture } from '../src/fixtures'

/** The five facets `facetClusteringFixture` produces, which the draft claims reference. */
const FACET_IDS = new Set(['f1', 'f2', 'f3', 'f4', 'f5'])

/** The two claims the mock run is built to surface as materially novel. */
const NOVEL_CLAIM_IDS = ['c004', 'c013']

interface GenerateFixture {
  bodyMarkdown: string
  faqItems: { question: string; answer: string }[]
}

/** What the scoring stage reads a draft as: the body plus its FAQ, as plain text. */
function draftPlainText(): string {
  const generated = mockFixture('generate') as GenerateFixture
  return [
    generated.bodyMarkdown,
    ...generated.faqItems.map((item) => `${item.question}\n${item.answer}`),
  ].join('\n\n')
}

const draftClaims = (): DraftClaim[] =>
  parseDraftClaims(mockFixture('claimExtraction', 'draft'), draftPlainText(), FACET_IDS)

interface JudgeFixture {
  claims: {
    claimId: string
    duplicateProbability: number
    internalDuplicateProbability: number
  }[]
}

interface VerifierFixture {
  claims: { claimId: string; support: number; contradiction: number }[]
}

describe('draft claim fixture', () => {
  it('parses and quotes every excerpt verbatim from the espresso draft', () => {
    const claims = draftClaims()

    assert.ok(claims.length >= 12, `expected at least 12 draft claims, got ${claims.length}`)
    const unquoted = claims.filter((claim) => !claim.excerptFound).map((claim) => claim.id)
    assert.deepEqual(unquoted, [])
  })

  it('generates the c001… ids the judge and verifier fixtures key off', () => {
    const claims = draftClaims()
    assert.deepEqual(
      claims.map((claim) => claim.id),
      claims.map((_, index) => `c${String(index + 1).padStart(3, '0')}`),
    )
  })

  it('assigns every claim to one of the five mock facets', () => {
    const claims = draftClaims()
    assert.deepEqual(
      claims.filter((claim) => claim.facetId === null),
      [],
    )
    assert.deepEqual(
      [...new Set(claims.map((claim) => claim.facetId))].sort(),
      [...FACET_IDS].sort(),
    )
  })

  it('records a section for every claim and claims no first-party measurement', () => {
    const claims = draftClaims()
    assert.deepEqual(
      claims.filter((claim) => claim.section === null),
      [],
    )
    assert.deepEqual(
      claims.filter((claim) => claim.type === 'first_party_measurement'),
      [],
    )
  })

  it('has exactly one restatement, pointing at an earlier claim', () => {
    const claims = draftClaims()
    const restating = claims.filter((claim) => claim.restatesClaimId !== null)
    assert.equal(restating.length, 1)

    const claim = restating[0]
    const earlier = claims.slice(0, claims.indexOf(claim))
    assert.ok(earlier.some((candidate) => candidate.id === claim.restatesClaimId))
    // The pointer, not lexical similarity, is what discounts it.
    assert.equal(intraDocumentNovelty(claim, earlier), 0.2)
  })
})

describe('information-gain judge fixture', () => {
  it('covers exactly the draft claim ids, and no others', () => {
    const claims = draftClaims()
    const fixture = mockFixture('informationGainJudge') as JudgeFixture

    assert.deepEqual(
      fixture.claims.map((claim) => claim.claimId),
      claims.map((claim) => claim.id),
    )
    assert.doesNotThrow(() =>
      parseJudgeReply(
        fixture,
        claims.map((claim) => claim.id),
        new Set(['q0', 'q1', 'q2', 'q3']),
        new Set(['b1-1', 'b1-2', 'b1-3', 'b1-4', 'b1-5', 'b1-6', 'b1-7', 'b1-8']),
      ),
    )
  })

  it('makes exactly two claims materially novel', () => {
    const claims = draftClaims()
    const signals = parseJudgeReply(
      mockFixture('informationGainJudge'),
      claims.map((claim) => claim.id),
      new Set(['q0', 'q1', 'q2', 'q3']),
      new Set(['b1-1', 'b1-2', 'b1-3', 'b1-4', 'b1-5', 'b1-6', 'b1-7', 'b1-8']),
    )

    const novel = [...signals.entries()]
      .filter(
        ([, signal]) => 1 - signal.duplicateProbability >= DEFAULT_POLICY.materialNoveltyThreshold,
      )
      .map(([claimId]) => claimId)
    assert.deepEqual(novel, NOVEL_CLAIM_IDS)

    // The two novel claims are the "40 percent" and "four to six weeks" ones.
    const byId = new Map(claims.map((claim) => [claim.id, claim]))
    assert.match(byId.get(NOVEL_CLAIM_IDS[0])?.text ?? '', /40 percent/)
    assert.match(byId.get(NOVEL_CLAIM_IDS[1])?.text ?? '', /four to six weeks/)
  })

  it('keeps every internal duplicate probability at or under 0.3', () => {
    const fixture = mockFixture('informationGainJudge') as JudgeFixture
    const tooHigh = fixture.claims.filter((claim) => claim.internalDuplicateProbability > 0.3)
    assert.deepEqual(tooHigh, [])
  })
})

describe('evidence verification fixture', () => {
  it('covers exactly the two materially novel claims', () => {
    const fixture = mockFixture('evidenceVerification') as VerifierFixture
    assert.deepEqual(
      fixture.claims.map((claim) => claim.claimId),
      NOVEL_CLAIM_IDS,
    )
  })

  it('supports each novel claim with quotable, exactly-matching evidence', () => {
    const claims = new Map(draftClaims().map((claim) => [claim.id, claim]))
    const signals = parseVerifierReply(mockFixture('evidenceVerification'), NOVEL_CLAIM_IDS)

    for (const claimId of NOVEL_CLAIM_IDS) {
      const claim = claims.get(claimId)
      const signal = signals.get(claimId)
      assert.ok(claim !== undefined && signal !== undefined, `missing ${claimId}`)

      // Verbatim value quotes are full entailment, so the fixture claims full support.
      assert.equal(signal.support, 1)
      assert.equal(signal.contradiction, 0.05)
      assert.ok(signal.evidence.length >= 2, `${claimId} needs at least two citations`)

      const evidence = signal.evidence.map((item) => extractValues(item.excerpt))
      for (const source of [claim.text, claim.excerpt]) {
        const { exactness, mismatches } = compareValues(extractValues(source), evidence)
        assert.deepEqual(mismatches, [], `${claimId}: ${source}`)
        assert.equal(exactness, 1, `${claimId}: ${source}`)
      }
    }
  })
})
