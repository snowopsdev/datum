import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_POLICY,
  type ClaimRecord,
  type DocumentScore,
  type DraftClaim,
  type EvidenceSourceRule,
  type JudgeSignals,
  type QueryClusterEntry,
  type Scorecard,
  type VerifierSignals,
} from '../src/informationGain/lib'
import {
  articleOutcome,
  buildClaimRecord,
  buildClaimSummary,
  buildRunRow,
  buildScorecard,
  DECISION_STATUS,
  deriveJudgeSignals,
  firstPartyOutcome,
  NEUTRAL_EVIDENCE,
  unjudgedSignals,
  unverifiedOutcome,
  verifiedOutcome,
} from '../src/informationGain/scorecard'
import { firstPartyMatches } from '../src/informationGain/passes'

const cluster: QueryClusterEntry[] = [
  { id: 'q0', text: 'home espresso', kind: 'keyword', weight: 0.5 },
  { id: 'q1', text: 'what does it cost?', kind: 'related_question', weight: 0.5 },
]

const judgeReply = (over: Partial<JudgeSignals> = {}): JudgeSignals => ({
  duplicateProbability: 0.2,
  closestBaselineClaimId: 'b1-1',
  internalDuplicateProbability: 0.1,
  closestInternalClaimId: null,
  relevanceByQuery: { q0: 1, q1: 0.5 },
  utility: { specificity: 1, actionability: 1, explanatoryPower: 1, audienceFit: 1 },
  importance: 1.4,
  containsNumericOrTemporalClaim: true,
  rationale: 'A specific figure the baseline does not state.',
  ...over,
})

const draftClaim = (over: Partial<DraftClaim> = {}): DraftClaim => ({
  id: 'c001',
  text: 'At least 40 percent of a first espresso budget goes to the grinder.',
  type: 'factual',
  excerpt: 'Put at least 40 percent of the budget into the grinder.',
  section: 'Budget',
  facetId: 'f1',
  entities: [],
  values: ['40 percent'],
  restatesClaimId: null,
  excerptFound: true,
  ...over,
})

const rules: EvidenceSourceRule[] = [
  { domain: 'sca.coffee', qualityClass: 'primary', active: true },
]

const verifierReply = (over: Partial<VerifierSignals> = {}): VerifierSignals => ({
  support: 1,
  contradiction: 0.05,
  evidence: [
    {
      url: 'https://sca.coffee/research/grinder-share',
      excerpt: 'Allocate at least 40 percent of an espresso budget to the grinder.',
      publisher: 'Specialty Coffee Association',
      sourceKind: 'official_docs',
    },
  ],
  notes: 'One primary source states the same share.',
  ...over,
})

test('novelty is the judge’s duplicate probability inverted', () => {
  const derived = deriveJudgeSignals(judgeReply({ duplicateProbability: 0.93 }), cluster)
  assert.equal(Math.round(derived.novelty * 100) / 100, 0.07)
})

test('relevance and utility collapse through the shared weightings', () => {
  const derived = deriveJudgeSignals(judgeReply(), cluster)
  // 0.5 * 1 + 0.5 * 0.5
  assert.equal(derived.relevance, 0.75)
  assert.equal(derived.utility, 1)
  assert.equal(derived.importance, 1.4)
  assert.equal(derived.containsNumericOrTemporalClaim, true)
})

test('importance is clamped into the scoring range', () => {
  assert.equal(deriveJudgeSignals(judgeReply({ importance: 9 }), cluster).importance, 2)
  assert.equal(deriveJudgeSignals(judgeReply({ importance: 0 }), cluster).importance, 0.5)
})

test('an unverified verifiable claim is baseline_corroborated with neutral values', () => {
  const outcome = unverifiedOutcome('factual')
  assert.equal(outcome.verificationMode, 'baseline_corroborated')
  assert.equal(outcome.evidenceSupport, 1)
  assert.equal(outcome.sourceQuality, 1)
  assert.equal(outcome.exactness, 1)
  assert.equal(outcome.contradictionProbability, 0)
  assert.deepEqual(outcome.evidence, [])
})

test('an unverifiable kind is not_applicable with the same neutral values', () => {
  for (const kind of ['recommendation', 'opinion', 'definition', 'comparison'] as const) {
    const outcome = unverifiedOutcome(kind)
    assert.equal(outcome.verificationMode, 'not_applicable', kind)
    assert.equal(outcome.evidenceSupport, NEUTRAL_EVIDENCE.evidenceSupport)
    assert.equal(outcome.sourceQuality, NEUTRAL_EVIDENCE.sourceQuality)
    assert.equal(outcome.exactness, NEUTRAL_EVIDENCE.exactness)
  }
})

test('with no baseline every claim is skipped_no_baseline, still neutral', () => {
  const outcome = unverifiedOutcome('factual', false)
  assert.equal(outcome.verificationMode, 'skipped_no_baseline')
  assert.equal(outcome.evidenceSupport, 1)
  assert.equal(outcome.sourceQuality, 1)
})

test('a verified claim scores its best citation, not an average', () => {
  const outcome = verifiedOutcome(
    draftClaim(),
    verifierReply({
      evidence: [
        ...verifierReply().evidence,
        {
          url: 'https://randomblog.example.com/espresso',
          excerpt: 'Spend at least 40 percent on the grinder.',
          publisher: null,
          sourceKind: 'unverified',
        },
      ],
    }),
    rules,
  )
  // sca.coffee matches a `primary` rule (0.95); the unclassified blog scores
  // 0.4 and must not drag the claim under the numeric integrity floor.
  assert.equal(outcome.sourceQuality, 0.95)
  assert.equal(outcome.evidence[0]?.qualitySource, 'evidence-sources')
  assert.equal(outcome.evidence[1]?.qualitySource, 'rubric')
  assert.equal(outcome.exactness, 1)
  assert.deepEqual(outcome.exactnessMismatches, [])
  assert.equal(outcome.verificationMode, 'verified')
})

test('exactness is measured against the quoted excerpts, not the verifier’s confidence', () => {
  const outcome = verifiedOutcome(
    draftClaim(),
    verifierReply({
      evidence: [
        {
          url: 'https://sca.coffee/research/grinder-share',
          excerpt: 'Allocate at least 25 percent of an espresso budget to the grinder.',
          publisher: 'Specialty Coffee Association',
          sourceKind: 'official_docs',
        },
      ],
    }),
    rules,
  )
  assert.equal(outcome.evidenceSupport, 1, 'the model still claimed full support')
  assert.ok(outcome.exactness < 1, 'but the numbers do not match')
  assert.ok(outcome.exactnessMismatches.length > 0)
})

test('a checked claim with no citation scores zero source quality, not neutral', () => {
  const outcome = verifiedOutcome(draftClaim(), verifierReply({ support: 0, evidence: [] }), rules)
  assert.equal(outcome.sourceQuality, 0)
  assert.equal(outcome.verificationMode, 'verified')
})

test('the decision map follows the global status contract', () => {
  assert.deepEqual(DECISION_STATUS, {
    PASS: 'verified',
    REVISE: 'needs_revision',
    HUMAN_REVIEW: 'needs_review',
    BLOCK: 'blocked',
  })
})

const scorecardFor = (over: Partial<Scorecard['scores']> = {}): Scorecard => ({
  scores: {
    potentialGainUnits: 2,
    verifiedGainUnits: 1.9,
    verificationRatio: 0.95,
    verifiedGainDensity: 3,
    facetGainCoverage: 0.8,
    blockedClaimIds: [],
    reviewClaimIds: [],
    materiallyNovelClaimIds: ['c004'],
    verifiedNovelClaimIds: ['c004'],
    consensusCoverage: 1,
    internalDuplicationRate: 0,
    ...over,
  },
  claimSummary: {
    totalClaims: 13,
    materiallyNovelClaims: 1,
    verifiedNovelClaims: 1,
    unsupportedNovelClaims: 0,
    contradictoryClaims: 0,
    firstPartyClaims: 0,
  },
  baselineAvailable: true,
})

test('a review outcome clears the stale reviewJustification, a pass does not', () => {
  const base = {
    runId: 7,
    policyVersion: 'ig-v1:abc',
    scorecard: scorecardFor(),
    totalCostUsd: 0.42,
    scoredAt: '2026-08-26T00:00:00.000Z',
  }
  for (const decision of ['HUMAN_REVIEW', 'BLOCK'] as const) {
    const outcome = articleOutcome({ ...base, decision })
    assert.equal(outcome.status, DECISION_STATUS[decision])
    assert.equal(
      outcome.data.reviewJustification,
      null,
      `${decision} must demand a fresh justification`,
    )
    assert.ok('reviewJustification' in outcome.data)
  }
  for (const decision of ['PASS', 'REVISE'] as const) {
    const outcome = articleOutcome({ ...base, decision })
    assert.equal(
      'reviewJustification' in outcome.data,
      false,
      `${decision} must not touch the justification`,
    )
  }
})

test('the article summary carries the headline scores and the run link', () => {
  const outcome = articleOutcome({
    decision: 'PASS',
    runId: 7,
    policyVersion: 'ig-v1:abc',
    scorecard: scorecardFor(),
    totalCostUsd: 0.42,
    scoredAt: '2026-08-26T00:00:00.000Z',
  })
  assert.equal(outcome.status, 'verified')
  assert.deepEqual(outcome.data.informationGain, {
    run: 7,
    decision: 'PASS',
    policyVersion: 'ig-v1:abc',
    consensusCoverage: 1,
    verifiedGainUnits: 1.9,
    verificationRatio: 0.95,
    internalDuplicationRate: 0,
    verifiedNovelClaims: 1,
    scoredAt: '2026-08-26T00:00:00.000Z',
  })
  assert.equal(outcome.data.totalCostUsd, 0.42)
})

test('unsupported novel claims are the gap between novel and verified-novel', () => {
  const scores = {
    materiallyNovelClaimIds: ['c1', 'c2', 'c3'],
    verifiedNovelClaimIds: ['c1'],
  } as DocumentScore
  const claims = [
    { contradictionProbability: 0.9, kind: 'factual' },
    { contradictionProbability: 0, kind: 'first_party_measurement' },
  ] as ClaimRecord[]
  const summary = buildClaimSummary(claims, scores, DEFAULT_POLICY)
  assert.equal(summary.totalClaims, 2)
  assert.equal(summary.materiallyNovelClaims, 3)
  assert.equal(summary.verifiedNovelClaims, 1)
  assert.equal(summary.unsupportedNovelClaims, 2)
  assert.equal(summary.contradictoryClaims, 1)
  assert.equal(summary.firstPartyClaims, 1)
})

test('with no baseline the two corpus ratios are null, not zero', () => {
  const claims = [
    buildClaimRecord(
      {
        claim: draftClaim(),
        judge: unjudgedSignals(),
        intraDocumentNovelty: 1,
        verification: unverifiedOutcome('factual', false),
      },
      DEFAULT_POLICY,
    ),
  ]
  const scores = {
    materiallyNovelClaimIds: [],
    verifiedNovelClaimIds: [],
  } as unknown as DocumentScore
  const scorecard = buildScorecard({
    claims,
    scores,
    facets: [],
    policy: DEFAULT_POLICY,
    baselineAvailable: false,
  })
  assert.equal(scorecard.baselineAvailable, false)
  assert.equal(scorecard.scores.consensusCoverage, null)
  assert.equal(scorecard.scores.internalDuplicationRate, null)
  assert.equal(claims[0]?.calibrated, false)
  assert.equal(claims[0]?.verificationMode, 'skipped_no_baseline')
})

test('the run row carries every field the collection defines', () => {
  const scorecard = scorecardFor()
  const row = buildRunRow({
    articleId: 3,
    pipelineRunId: 'run-1',
    snapshotId: 9,
    policyVersion: 'ig-v1:abc',
    policy: { policy: DEFAULT_POLICY, sources: {} },
    models: { claimExtraction: 'claude-opus-5' },
    decision: 'PASS',
    reasons: [],
    scorecard,
    claims: [],
    tokenCount: 900,
    costUsd: 0.31,
    draftUpdatedAt: '2026-08-26T00:00:00.000Z',
  })
  assert.deepEqual(Object.keys(row).sort(), [
    'article',
    'baselineAvailable',
    'calibrated',
    'claimIds',
    'claimSummary',
    'claims',
    'costUsd',
    'decision',
    'draftUpdatedAt',
    'models',
    'pipelineRunId',
    'policy',
    'policyVersion',
    'reasons',
    'scores',
    'snapshot',
    'tokenCount',
  ])
  assert.equal(row.calibrated, false, 'every stored signal is an uncalibrated estimate')
  assert.equal(row.article, 3)
  assert.equal(row.snapshot, 9)
  assert.deepEqual(row.scores, {
    consensusCoverage: 1,
    potentialGainUnits: 2,
    verifiedGainUnits: 1.9,
    verificationRatio: 0.95,
    verifiedGainDensity: 3,
    facetGainCoverage: 0.8,
    internalDuplicationRate: 0,
  })
  assert.deepEqual(row.claimIds, {
    blocked: [],
    review: [],
    materiallyNovel: ['c004'],
    verifiedNovel: ['c004'],
  })
  assert.deepEqual(row.claimSummary, scorecard.claimSummary)
})

/**
 * A claim the workspace's own evidence bank already backs never reaches the web
 * verifier.
 *
 * The verifier searches the open web, and a private company's own measurement
 * is by construction not there — so sending one costs a search to learn
 * nothing, and then scores the claim down for the silence. The bank is the
 * citation, and the evidence check has already judged the sentence against that
 * entry's limits before this stage runs.
 */
test('firstPartyMatches pairs a draft claim with the bank entry the draft cited', () => {
  const claims = [
    draftClaim({
      id: 'c1',
      text: 'A reviewer approves the brief before any drafting is paid for, on every article.',
    }),
    draftClaim({ id: 'c2', text: 'Roasted coffee holds its peak flavour for four to six weeks.' }),
  ]
  const matches = firstPartyMatches(claims, [
    {
      ref: 'E1',
      // The writer's sentence; the extractor's paraphrase of it is `c1`.
      excerpt: 'A reviewer approves the brief before any drafting is paid for, on every article.',
    },
  ])
  assert.deepEqual([...matches], [['c1', 'E1']])
})

test('firstPartyMatches ignores fragments too short to identify a claim', () => {
  const claims = [draftClaim({ id: 'c1', text: 'It is fast.' })]
  assert.equal(firstPartyMatches(claims, [{ ref: 'E1', excerpt: 'It is fast.' }]).size, 0)
  assert.equal(firstPartyMatches(claims, []).size, 0)
})

test('firstPartyMatches tolerates punctuation and case differing between the two', () => {
  const claims = [
    draftClaim({
      id: 'c1',
      text: 'the median article costs under two dollars of model spend',
    }),
  ]
  const matches = firstPartyMatches(claims, [
    {
      ref: 'E3',
      excerpt: 'The median article costs under two dollars of model spend, end to end.',
    },
  ])
  assert.deepEqual([...matches], [['c1', 'E3']])
})

test('a first-party outcome is verified, first-party sourced, and says it skipped the web', () => {
  const outcome = firstPartyOutcome('E1', 'A reviewer approves the brief.')
  assert.equal(outcome.verificationMode, 'verified')
  assert.equal(outcome.evidenceSupport, 1)
  assert.equal(outcome.sourceQuality, 1)
  assert.equal(outcome.contradictionProbability, 0)
  assert.equal(outcome.evidence[0].sourceKind, 'first_party_dataset')
  assert.match(String(outcome.verifierNotes), /evidence-bank entry E1; not sent to the web verifier/)
})
