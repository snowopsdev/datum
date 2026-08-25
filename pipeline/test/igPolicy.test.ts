import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  decidePolicy,
  DEFAULT_POLICY,
  maxDecision,
  POLICY_CODES,
  POLICY_FIELDS,
  resolvePolicy,
  type ClaimRecord,
  type Decision,
  type Evidence,
  type PolicyCode,
  type PolicyKey,
  type PolicyReason,
  type Scorecard,
} from '../src/informationGain/lib'
import { policyVersion } from '../src/informationGain/policyVersion'

const evidence = (): Evidence => ({
  url: 'https://example.com/report',
  excerpt: 'Revenue grew 14% in 2025.',
  publisher: 'Example Analytics',
  sourceKind: 'primary',
  domain: 'example.com',
  qualityScore: 0.95,
  qualitySource: 'evidence-sources',
})

/** A claim that trips no gate on its own. */
const makeClaim = (overrides: Partial<ClaimRecord> = {}): ClaimRecord => {
  const base: ClaimRecord = {
    id: 'c001',
    kind: 'factual',
    importance: 1,
    novelty: 0.9,
    relevance: 0.9,
    utility: 0.8,
    intraDocumentNovelty: 1,
    evidenceSupport: 1,
    sourceQuality: 0.96,
    exactness: 1,
    contradictionProbability: 0,
    containsNumericOrTemporalClaim: false,
    verificationMode: 'verified',
    calibrated: false,
    text: 'Example grew revenue 14% in 2025.',
    excerpt: 'grew revenue 14% in 2025',
    section: 'Growth',
    facetId: 'f1',
    closestBaselineClaimId: null,
    closestInternalClaimId: null,
    internalDuplicateProbability: 0,
    evidence: [evidence()],
    exactnessMismatches: [],
    judgeRationale: 'Supported by the cited filing.',
    verifierNotes: null,
    scored: {
      id: 'c001',
      potentialGain: 0.5,
      verifiedGain: 0.48,
      evidenceIntegrity: 0.96,
      blocked: false,
      requiresHumanReview: false,
      reasons: [],
    },
  }
  const merged = { ...base, ...overrides }
  return { ...merged, scored: { ...merged.scored, id: merged.id } }
}

/** A scorecard that trips no gate on its own. */
const makeScorecard = (
  scores: Partial<Scorecard['scores']> = {},
  overrides: Partial<Omit<Scorecard, 'scores'>> = {},
): Scorecard => ({
  scores: {
    potentialGainUnits: 1.2,
    verifiedGainUnits: 1.15,
    verificationRatio: 0.96,
    verifiedGainDensity: 0.57,
    facetGainCoverage: 0.8,
    blockedClaimIds: [],
    reviewClaimIds: [],
    materiallyNovelClaimIds: ['c001'],
    verifiedNovelClaimIds: ['c001'],
    consensusCoverage: 0.9,
    internalDuplicationRate: 0.1,
    ...scores,
  },
  claimSummary: {
    totalClaims: 1,
    materiallyNovelClaims: 1,
    verifiedNovelClaims: 1,
    unsupportedNovelClaims: 0,
    contradictoryClaims: 0,
    firstPartyClaims: 0,
  },
  baselineAvailable: true,
  ...overrides,
})

const reason = (
  policy: PolicyCode,
  severity: PolicyReason['severity'],
  claimId?: string,
): PolicyReason => ({ policy, severity, claimId, message: `${policy} fired.` })

describe('resolvePolicy', () => {
  it('falls back to the platform defaults with no admin doc and no env', () => {
    const resolved = resolvePolicy(null, {})
    assert.deepEqual(resolved.policy, DEFAULT_POLICY)
    for (const field of POLICY_FIELDS) {
      assert.equal(resolved.sources[field.key as PolicyKey], 'default', field.key)
    }
  })

  it('derives DEFAULT_POLICY from the POLICY_FIELDS table', () => {
    assert.equal(POLICY_FIELDS.length, 11)
    for (const field of POLICY_FIELDS) {
      assert.equal(DEFAULT_POLICY[field.key as PolicyKey], field.default, field.key)
    }
  })

  it('prefers the admin value over the env override', () => {
    const resolved = resolvePolicy(
      { minConsensusCoverage: 0.8 },
      { INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE: '0.6' },
    )
    assert.equal(resolved.policy.minConsensusCoverage, 0.8)
    assert.equal(resolved.sources.minConsensusCoverage, 'admin')
  })

  it('prefers the env override over the default', () => {
    const resolved = resolvePolicy(null, { INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE: '0.6' })
    assert.equal(resolved.policy.minConsensusCoverage, 0.6)
    assert.equal(resolved.sources.minConsensusCoverage, 'env')
  })

  it('ignores an unparseable env value', () => {
    const resolved = resolvePolicy(null, { INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE: 'abc' })
    assert.equal(resolved.policy.minConsensusCoverage, 0.75)
    assert.equal(resolved.sources.minConsensusCoverage, 'default')
  })

  it('ignores an empty or blank env value rather than reading it as zero', () => {
    const blank = resolvePolicy(null, {
      INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE: '',
      INFORMATION_GAIN_MIN_VERIFICATION_RATIO: '   ',
    })
    assert.equal(blank.policy.minConsensusCoverage, 0.75)
    assert.equal(blank.policy.minVerificationRatio, 0.9)
    assert.equal(blank.sources.minVerificationRatio, 'default')
  })

  it('ignores an out-of-range ratio from the admin doc but keeps the env value', () => {
    const resolved = resolvePolicy(
      { minConsensusCoverage: 1.5 },
      { INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE: '0.6' },
    )
    assert.equal(resolved.policy.minConsensusCoverage, 0.6)
    assert.equal(resolved.sources.minConsensusCoverage, 'env')
  })

  it('accepts the ratio boundaries', () => {
    const resolved = resolvePolicy({ minConsensusCoverage: 0, minVerificationRatio: 1 }, {})
    assert.equal(resolved.policy.minConsensusCoverage, 0)
    assert.equal(resolved.policy.minVerificationRatio, 1)
    assert.equal(resolved.sources.minConsensusCoverage, 'admin')
  })

  it('parses booleans from the admin doc and the env, case-insensitively', () => {
    const adminOff = resolvePolicy({ requireExactValueMatch: false }, {})
    assert.equal(adminOff.policy.requireExactValueMatch, false)
    assert.equal(adminOff.sources.requireExactValueMatch, 'admin')
    const off = resolvePolicy(null, { INFORMATION_GAIN_REQUIRE_EXACT_VALUE_MATCH: 'no' })
    assert.equal(off.policy.requireExactValueMatch, false)
    assert.equal(off.sources.requireExactValueMatch, 'env')
    assert.equal(
      resolvePolicy(null, { INFORMATION_GAIN_REQUIRE_EVIDENCE_LINEAGE: 'FALSE' }).policy
        .requireEvidenceLineage,
      false,
    )
    assert.equal(
      resolvePolicy(null, { INFORMATION_GAIN_BLOCK_FIRST_PARTY_MEASUREMENTS: '0' }).policy
        .blockFirstPartyMeasurements,
      false,
    )
    assert.equal(
      resolvePolicy(null, { INFORMATION_GAIN_REQUIRE_EXACT_VALUE_MATCH: 'Yes' }).policy
        .requireExactValueMatch,
      true,
    )
    const bogus = resolvePolicy(null, { INFORMATION_GAIN_REQUIRE_EXACT_VALUE_MATCH: 'maybe' })
    assert.equal(bogus.policy.requireExactValueMatch, true)
    assert.equal(bogus.sources.requireExactValueMatch, 'default')
  })

  it('rejects a non-boolean admin value for a boolean field', () => {
    const resolved = resolvePolicy({ requireExactValueMatch: 'true' }, {})
    assert.equal(resolved.policy.requireExactValueMatch, true)
    assert.equal(resolved.sources.requireExactValueMatch, 'default')
  })

  it('requires counts to be non-negative integers', () => {
    assert.equal(
      resolvePolicy(null, { INFORMATION_GAIN_MIN_VERIFIED_NOVEL_CLAIMS: '2.5' }).sources
        .minVerifiedNovelClaims,
      'default',
    )
    const negative = resolvePolicy({ minVerifiedNovelClaims: -1 }, {})
    assert.equal(negative.sources.minVerifiedNovelClaims, 'default')
    const two = resolvePolicy(null, { INFORMATION_GAIN_MIN_VERIFIED_NOVEL_CLAIMS: '2' })
    assert.equal(two.policy.minVerifiedNovelClaims, 2)
    assert.equal(two.sources.minVerifiedNovelClaims, 'env')
    assert.equal(resolvePolicy({ minVerifiedNovelClaims: 0 }, {}).policy.minVerifiedNovelClaims, 0)
  })

  it('serialises a canonical policy string with alphabetically sorted keys', () => {
    assert.equal(
      resolvePolicy(null, {}).canonical,
      '{"blockFirstPartyMeasurements":true,"materialNoveltyThreshold":0.55,' +
        '"maxContradictionProbability":0.25,"maxInternalDuplicationRate":0.35,' +
        '"minConsensusCoverage":0.75,"minNovelFactualIntegrity":0.9,' +
        '"minNumericTemporalIntegrity":0.95,"minVerificationRatio":0.9,' +
        '"minVerifiedNovelClaims":1,"requireEvidenceLineage":true,' +
        '"requireExactValueMatch":true,"schema":1}',
    )
  })

  it('produces the same canonical string regardless of admin key order', () => {
    const a = resolvePolicy({ minConsensusCoverage: 0.8, requireExactValueMatch: false }, {})
    const b = resolvePolicy({ requireExactValueMatch: false, minConsensusCoverage: 0.8 }, {})
    assert.equal(a.canonical, b.canonical)
    assert.notEqual(a.canonical, resolvePolicy(null, {}).canonical)
  })

  it('hashes the canonical string into a stable policy version', () => {
    const canonical = resolvePolicy(null, {}).canonical
    const version = policyVersion(canonical)
    assert.match(version, /^ig-v1:[0-9a-f]{16}$/)
    assert.equal(version, policyVersion(canonical))
    const other = resolvePolicy({ minConsensusCoverage: 0.8 }, {}).canonical
    assert.notEqual(version, policyVersion(other))
  })
})

describe('maxDecision', () => {
  it('is PASS for no reasons and otherwise the most severe outcome', () => {
    assert.equal(maxDecision([]), 'PASS')
    assert.equal(maxDecision([reason('NO_VERIFIED_NOVEL_CLAIM', 'REVISE')]), 'REVISE')
    assert.equal(
      maxDecision([
        reason('NO_VERIFIED_NOVEL_CLAIM', 'REVISE'),
        reason('CONTRADICTION_REQUIRES_REVIEW', 'HUMAN_REVIEW'),
      ]),
      'HUMAN_REVIEW',
    )
    assert.equal(
      maxDecision([
        reason('CONTRADICTION_REQUIRES_REVIEW', 'HUMAN_REVIEW'),
        reason('VERIFICATION_RATIO_BELOW_MIN', 'BLOCK'),
        reason('NO_VERIFIED_NOVEL_CLAIM', 'REVISE'),
      ]),
      'BLOCK',
    )
  })
})

describe('decidePolicy', () => {
  it('passes a clean scorecard with no reasons', () => {
    const result = decidePolicy(makeScorecard(), [makeClaim()], DEFAULT_POLICY)
    assert.equal(result.decision, 'PASS')
    assert.deepEqual(result.reasons, [])
  })

  const gates: {
    name: string
    code: PolicyCode
    decision: Decision
    message: string
    scorecard: Scorecard
    claims: ClaimRecord[]
  }[] = [
    {
      name: 'no baseline corpus',
      code: 'BASELINE_UNAVAILABLE',
      decision: 'HUMAN_REVIEW',
      message: 'No baseline corpus was available; scoring skipped.',
      scorecard: makeScorecard({}, { baselineAvailable: false }),
      claims: [makeClaim()],
    },
    {
      name: 'consensus coverage below the minimum',
      code: 'COVERAGE_BELOW_MIN',
      decision: 'REVISE',
      message: 'Consensus coverage was 0.62; minimum is 0.75.',
      scorecard: makeScorecard({ consensusCoverage: 0.62 }),
      claims: [makeClaim()],
    },
    {
      name: 'verification ratio below the minimum',
      code: 'VERIFICATION_RATIO_BELOW_MIN',
      decision: 'BLOCK',
      message: 'Verification ratio was 0.50; minimum is 0.90.',
      scorecard: makeScorecard({ verificationRatio: 0.5 }),
      claims: [makeClaim()],
    },
    {
      name: 'an unsupported novel factual claim',
      code: 'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT',
      decision: 'BLOCK',
      message: 'Evidence integrity was 0.30; minimum is 0.90.',
      scorecard: makeScorecard(),
      claims: [
        makeClaim({
          scored: {
            id: 'c001',
            potentialGain: 0.28,
            verifiedGain: 0,
            evidenceIntegrity: 0.3,
            blocked: true,
            requiresHumanReview: false,
            reasons: [
              {
                policy: 'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT',
                claimId: 'c001',
                severity: 'BLOCK',
                message: 'Evidence integrity was 0.30; minimum is 0.90.',
              },
            ],
          },
        }),
      ],
    },
    {
      name: 'a numeric claim without an exact match',
      code: 'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT',
      decision: 'BLOCK',
      message: 'Numeric or temporal values do not exactly match the evidence.',
      scorecard: makeScorecard(),
      claims: [
        makeClaim({
          containsNumericOrTemporalClaim: true,
          scored: {
            id: 'c001',
            potentialGain: 0.6,
            verifiedGain: 0,
            evidenceIntegrity: 0.96,
            blocked: true,
            requiresHumanReview: false,
            reasons: [
              {
                policy: 'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT',
                claimId: 'c001',
                severity: 'BLOCK',
                message: 'Numeric or temporal values do not exactly match the evidence.',
              },
            ],
          },
        }),
      ],
    },
    {
      name: 'a contradicting claim',
      code: 'CONTRADICTION_REQUIRES_REVIEW',
      decision: 'HUMAN_REVIEW',
      message: 'Contradiction probability was 0.31; maximum is 0.25.',
      scorecard: makeScorecard(),
      claims: [
        makeClaim({
          contradictionProbability: 0.31,
          scored: {
            id: 'c001',
            potentialGain: 0.5,
            verifiedGain: 0.48,
            evidenceIntegrity: 0.96,
            blocked: false,
            requiresHumanReview: true,
            reasons: [
              {
                policy: 'CONTRADICTION_REQUIRES_REVIEW',
                claimId: 'c001',
                severity: 'HUMAN_REVIEW',
                message: 'Contradiction probability was 0.31; maximum is 0.25.',
              },
            ],
          },
        }),
      ],
    },
    {
      name: 'a materially novel inference',
      code: 'NOVEL_INFERENCE_REQUIRES_REVIEW',
      decision: 'HUMAN_REVIEW',
      message: 'Materially novel inference requires human review.',
      scorecard: makeScorecard(),
      claims: [
        makeClaim({
          kind: 'inference',
          scored: {
            id: 'c001',
            potentialGain: 0.5,
            verifiedGain: 0.48,
            evidenceIntegrity: 0.96,
            blocked: false,
            requiresHumanReview: true,
            reasons: [
              {
                policy: 'NOVEL_INFERENCE_REQUIRES_REVIEW',
                claimId: 'c001',
                severity: 'HUMAN_REVIEW',
                message: 'Materially novel inference requires human review.',
              },
            ],
          },
        }),
      ],
    },
    {
      name: 'a novel claim citing no evidence',
      code: 'EVIDENCE_LINEAGE_MISSING',
      decision: 'BLOCK',
      message: 'Claim c004 is materially novel but cites no evidence.',
      scorecard: makeScorecard(),
      claims: [makeClaim({ id: 'c004', evidence: [] })],
    },
    {
      name: 'a claimed first-party measurement',
      code: 'FIRST_PARTY_MEASUREMENT_PRESENT',
      decision: 'BLOCK',
      message:
        'Claim c005 asserts a first-party measurement, which a model-generated draft cannot have produced.',
      scorecard: makeScorecard(),
      claims: [makeClaim({ id: 'c005', kind: 'first_party_measurement' })],
    },
    {
      name: 'too much overlap with already published articles',
      code: 'INTERNAL_DUPLICATION_REQUIRES_REVIEW',
      decision: 'HUMAN_REVIEW',
      message: 'Internal duplication rate was 0.42; maximum is 0.35.',
      scorecard: makeScorecard({ internalDuplicationRate: 0.42 }),
      claims: [makeClaim()],
    },
    {
      name: 'no verified novel claim at all',
      code: 'NO_VERIFIED_NOVEL_CLAIM',
      decision: 'REVISE',
      message: 'Only 0 materially novel claim(s) were verified; minimum is 1.',
      scorecard: makeScorecard({ verifiedNovelClaimIds: [] }),
      claims: [makeClaim()],
    },
  ]

  for (const gate of gates) {
    it(`flags ${gate.name} as ${gate.code}`, () => {
      const result = decidePolicy(gate.scorecard, gate.claims, DEFAULT_POLICY)
      assert.equal(result.reasons.length, 1, JSON.stringify(result.reasons))
      assert.equal(result.reasons[0].policy, gate.code)
      assert.equal(result.reasons[0].severity, gate.decision)
      assert.equal(result.reasons[0].message, gate.message)
      assert.equal(result.decision, gate.decision)
    })
  }

  it('has a gate for every policy code', () => {
    assert.deepEqual([...gates.map((g) => g.code)].sort(), [...POLICY_CODES].sort())
  })

  it('stops at BASELINE_UNAVAILABLE even when other gates would fire', () => {
    const result = decidePolicy(
      makeScorecard(
        { consensusCoverage: 0.1, verificationRatio: 0, verifiedNovelClaimIds: [] },
        { baselineAvailable: false },
      ),
      [makeClaim({ kind: 'first_party_measurement', evidence: [] })],
      DEFAULT_POLICY,
    )
    assert.equal(result.reasons.length, 1)
    assert.equal(result.reasons[0].policy, 'BASELINE_UNAVAILABLE')
    assert.equal(result.decision, 'HUMAN_REVIEW')
  })

  it('takes the most severe decision while keeping every reason', () => {
    const result = decidePolicy(
      makeScorecard({ consensusCoverage: 0.62 }),
      [makeClaim({ id: 'c004', evidence: [] })],
      DEFAULT_POLICY,
    )
    assert.equal(result.decision, 'BLOCK')
    assert.deepEqual(
      result.reasons.map((r) => r.policy).sort(),
      ['COVERAGE_BELOW_MIN', 'EVIDENCE_LINEAGE_MISSING'],
    )
  })

  it('skips the verification-ratio gate when there is no potential gain to verify', () => {
    const result = decidePolicy(
      makeScorecard({ verificationRatio: 0, potentialGainUnits: 0 }),
      [makeClaim()],
      DEFAULT_POLICY,
    )
    assert.deepEqual(result.reasons, [])
  })

  it('skips the coverage and duplication gates when those scores are null', () => {
    const result = decidePolicy(
      makeScorecard({ consensusCoverage: null, internalDuplicationRate: null }),
      [makeClaim()],
      DEFAULT_POLICY,
    )
    assert.deepEqual(result.reasons, [])
  })

  it('only requires evidence lineage for verified, materially novel, verifiable claims', () => {
    const exempt = [
      makeClaim({ id: 'e1', evidence: [], kind: 'opinion' }),
      makeClaim({ id: 'e2', evidence: [], novelty: 0.2 }),
      makeClaim({ id: 'e3', evidence: [], verificationMode: 'skipped_no_baseline' }),
    ]
    assert.deepEqual(decidePolicy(makeScorecard(), exempt, DEFAULT_POLICY).reasons, [])
  })

  it('honours the lineage and first-party switches being turned off', () => {
    const policy = {
      ...DEFAULT_POLICY,
      requireEvidenceLineage: false,
      blockFirstPartyMeasurements: false,
    }
    const claims = [
      makeClaim({ id: 'c004', evidence: [] }),
      makeClaim({ id: 'c005', kind: 'first_party_measurement' }),
    ]
    assert.deepEqual(decidePolicy(makeScorecard(), claims, policy).reasons, [])
  })

  it('de-duplicates reasons by policy code and claim', () => {
    const duplicated = makeClaim({
      id: 'c004',
      evidence: [],
      scored: {
        id: 'c004',
        potentialGain: 0.5,
        verifiedGain: 0,
        evidenceIntegrity: 0,
        blocked: true,
        requiresHumanReview: false,
        reasons: [
          {
            policy: 'EVIDENCE_LINEAGE_MISSING',
            claimId: 'c004',
            severity: 'BLOCK',
            message: 'Claim c004 is materially novel but cites no evidence.',
          },
          {
            policy: 'EVIDENCE_LINEAGE_MISSING',
            claimId: 'c004',
            severity: 'BLOCK',
            message: 'Claim c004 is materially novel but cites no evidence.',
          },
        ],
      },
    })
    const result = decidePolicy(makeScorecard(), [duplicated], DEFAULT_POLICY)
    assert.equal(result.reasons.length, 1)
    assert.equal(result.reasons[0].policy, 'EVIDENCE_LINEAGE_MISSING')
  })

  it('reports the same gate separately for each offending claim', () => {
    const result = decidePolicy(
      makeScorecard(),
      [makeClaim({ id: 'c004', evidence: [] }), makeClaim({ id: 'c007', evidence: [] })],
      DEFAULT_POLICY,
    )
    assert.deepEqual(
      result.reasons.map((r) => r.claimId),
      ['c004', 'c007'],
    )
  })
})
