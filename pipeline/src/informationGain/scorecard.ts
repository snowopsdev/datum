/**
 * Every decision the information-gain stage makes that does not need Payload or
 * an LLM: turning a judge reply into signals, deciding what an unchecked claim
 * is worth, assembling the claim records and the scorecard, and mapping a
 * decision onto an article status and a stored run row.
 *
 * It lives beside the stage rather than inside it so all of it can be unit
 * tested without booting Payload (`pipeline/test/igStage.test.ts`), and so the
 * stage file stays a readable list of the calls it makes.
 *
 * Every 0–1 number that passes through here is an uncalibrated LLM estimate.
 * Nothing in this file calibrates them; it arranges them for the policy gate,
 * which is the only place a verdict is reached.
 */

import type { Article, InformationGainRun } from '../../../cms/src/payload-types'
import type { ArticleStatus, StageOutcome } from '../stages'

import {
  clamp01,
  clampImportance,
  compareValues,
  consensusCoverage,
  extractValues,
  hostnameOf,
  internalDuplicationRate,
  isVerifiableClaimType,
  relevanceFromQueries,
  resolveSourceQuality,
  scoreClaim,
  utilityFromRubric,
  type ClaimRecord,
  type ClaimSignals,
  type ClaimSummary,
  type ClaimType,
  type Decision,
  type DocumentScore,
  type DraftClaim,
  type Evidence,
  type EvidenceSourceRule,
  type Facet,
  type InformationGainPolicy,
  type JudgeSignals,
  type PolicyReason,
  type QueryClusterEntry,
  type Scorecard,
  type VerificationMode,
  type VerifierSignals,
} from './lib'

/** What the judge pass contributes to one claim, before any outside evidence. */
export interface JudgeDerived {
  novelty: number
  relevance: number
  utility: number
  importance: number
  containsNumericOrTemporalClaim: boolean
  internalDuplicateProbability: number
  closestBaselineClaimId: string | null
  closestInternalClaimId: string | null
  judgeRationale: string
}

/**
 * Novelty is the judge's duplicate probability inverted: a claim the ranking
 * pages already make adds nothing, however well it is written. Relevance and
 * utility collapse the judge's per-query and per-rubric scores through the
 * shared weightings so the pipeline and the admin read them identically.
 */
export function deriveJudgeSignals(
  judge: JudgeSignals,
  cluster: QueryClusterEntry[],
): JudgeDerived {
  return {
    novelty: clamp01(1 - clamp01(judge.duplicateProbability)),
    relevance: relevanceFromQueries(judge.relevanceByQuery, cluster),
    utility: utilityFromRubric(judge.utility),
    importance: clampImportance(judge.importance),
    containsNumericOrTemporalClaim: judge.containsNumericOrTemporalClaim,
    internalDuplicateProbability: clamp01(judge.internalDuplicateProbability),
    closestBaselineClaimId: judge.closestBaselineClaimId,
    closestInternalClaimId: judge.closestInternalClaimId,
    judgeRationale: judge.rationale,
  }
}

/** The evidence half of a claim's signals, however it was (or was not) checked. */
export interface VerificationOutcome {
  evidenceSupport: number
  sourceQuality: number
  exactness: number
  contradictionProbability: number
  verificationMode: VerificationMode
  evidence: Evidence[]
  exactnessMismatches: string[]
  verifierNotes: string | null
}

/**
 * What a claim nobody checked is worth.
 *
 * Deliberately neutral — support, source quality, and exactness all 1, no
 * contradiction — because these are *absences of evidence*, not findings.
 * Evidence integrity multiplies through into the document's verification ratio,
 * so scoring an unchecked claim at 0 would let a draft full of ordinary
 * restatements of the consensus fail a BLOCK gate that exists to catch
 * unsupported *novel* claims. The verification mode records which kind of
 * silence it was, and only `verified` claims can ever be blocked (see
 * `scoreClaim`), so the neutrals cannot launder a claim past the gates.
 */
export const NEUTRAL_EVIDENCE = Object.freeze({
  evidenceSupport: 1,
  sourceQuality: 1,
  exactness: 1,
  contradictionProbability: 0,
})

/**
 * The mode for a claim the verifier never saw: `not_applicable` when no
 * citation could settle it (an opinion, a recommendation), `skipped_no_baseline`
 * when there was no corpus to judge novelty against in the first place, and
 * `baseline_corroborated` for a verifiable claim the judge found the baseline
 * already makes — the ranking pages are its corroboration.
 */
export function unverifiedOutcome(kind: ClaimType, baselineAvailable = true): VerificationOutcome {
  const verificationMode: VerificationMode = !baselineAvailable
    ? 'skipped_no_baseline'
    : isVerifiableClaimType(kind)
      ? 'baseline_corroborated'
      : 'not_applicable'
  return {
    ...NEUTRAL_EVIDENCE,
    verificationMode,
    evidence: [],
    exactnessMismatches: [],
    verifierNotes: null,
  }
}

/**
 * What the verifier actually found for one claim.
 *
 * Source quality is the *best* citation's score rather than an average: one
 * primary source settles a claim, and averaging would let a stray unverified
 * blog drag a properly sourced claim under the integrity floor. Exactness is
 * deterministic and never asked of the model — the claim's own numbers are
 * compared against the quoted excerpts by `compareValues`, so a verifier that
 * says "support 1.0" over evidence stating a different figure still fails.
 */
export function verifiedOutcome(
  claim: DraftClaim,
  verifier: VerifierSignals,
  rules: EvidenceSourceRule[],
): VerificationOutcome {
  const evidence: Evidence[] = verifier.evidence.map((item) => {
    const quality = resolveSourceQuality(item.url, rules, item.sourceKind)
    return {
      url: item.url,
      excerpt: item.excerpt,
      publisher: item.publisher,
      sourceKind: item.sourceKind,
      domain: hostnameOf(item.url) ?? '',
      qualityScore: quality.score,
      qualitySource: quality.source,
    }
  })

  const { exactness, mismatches } = compareValues(
    extractValues(claim.text),
    evidence.map((item) => extractValues(item.excerpt)),
  )

  return {
    evidenceSupport: clamp01(verifier.support),
    // No citation is no quality, not neutral quality: this claim *was* checked.
    sourceQuality: evidence.reduce((best, item) => Math.max(best, item.qualityScore), 0),
    exactness,
    contradictionProbability: clamp01(verifier.contradiction),
    verificationMode: 'verified',
    evidence,
    exactnessMismatches: mismatches,
    verifierNotes: verifier.notes,
  }
}

/** Everything known about one claim, ready to be scored. */
export interface ClaimInput {
  claim: DraftClaim
  judge: JudgeDerived
  intraDocumentNovelty: number
  verification: VerificationOutcome
}

/**
 * A claim with no judge pass behind it — the baseline-unavailable path. Novelty,
 * relevance, and utility are all comparisons *against a baseline*, so with no
 * baseline they are unmeasured rather than zero-because-bad; the decision never
 * rests on them (`decidePolicy` short-circuits to BASELINE_UNAVAILABLE), and
 * recording 0 keeps the stored scorecard from implying a judgement nobody made.
 */
export function unjudgedSignals(): JudgeDerived {
  return {
    novelty: 0,
    relevance: 0,
    utility: 0,
    importance: 1,
    containsNumericOrTemporalClaim: false,
    internalDuplicateProbability: 0,
    closestBaselineClaimId: null,
    closestInternalClaimId: null,
    judgeRationale: 'No baseline corpus was available, so this claim was not judged.',
  }
}

/** The signals half of a claim record, in the shape `scoreClaim`/`scoreDocument` take. */
export function toClaimSignals(input: ClaimInput): ClaimSignals {
  return {
    id: input.claim.id,
    kind: input.claim.type,
    importance: input.judge.importance,
    novelty: input.judge.novelty,
    relevance: input.judge.relevance,
    utility: input.judge.utility,
    intraDocumentNovelty: input.intraDocumentNovelty,
    evidenceSupport: input.verification.evidenceSupport,
    sourceQuality: input.verification.sourceQuality,
    exactness: input.verification.exactness,
    contradictionProbability: input.verification.contradictionProbability,
    containsNumericOrTemporalClaim: input.judge.containsNumericOrTemporalClaim,
    verificationMode: input.verification.verificationMode,
    calibrated: false,
  }
}

/** The full stored record for one claim: its signals, its evidence, and its score. */
export function buildClaimRecord(input: ClaimInput, policy: InformationGainPolicy): ClaimRecord {
  const signals = toClaimSignals(input)
  return {
    ...signals,
    text: input.claim.text,
    excerpt: input.claim.excerpt,
    section: input.claim.section,
    facetId: input.claim.facetId,
    closestBaselineClaimId: input.judge.closestBaselineClaimId,
    closestInternalClaimId: input.judge.closestInternalClaimId,
    internalDuplicateProbability: input.judge.internalDuplicateProbability,
    evidence: input.verification.evidence,
    exactnessMismatches: input.verification.exactnessMismatches,
    judgeRationale: input.judge.judgeRationale,
    verifierNotes: input.verification.verifierNotes,
    scored: scoreClaim(signals, policy),
  }
}

/**
 * The headline counts a reviewer reads before opening the claim list.
 * `unsupportedNovelClaims` is the gap between the two novelty counts: claims the
 * draft is betting its value on that no citation stands behind.
 */
export function buildClaimSummary(
  claims: ClaimRecord[],
  scores: DocumentScore,
  policy: InformationGainPolicy,
): ClaimSummary {
  return {
    totalClaims: claims.length,
    materiallyNovelClaims: scores.materiallyNovelClaimIds.length,
    verifiedNovelClaims: scores.verifiedNovelClaimIds.length,
    unsupportedNovelClaims:
      scores.materiallyNovelClaimIds.length - scores.verifiedNovelClaimIds.length,
    contradictoryClaims: claims.filter(
      (claim) => claim.contradictionProbability >= policy.maxContradictionProbability,
    ).length,
    firstPartyClaims: claims.filter((claim) => claim.kind === 'first_party_measurement').length,
  }
}

/** The scorecard the policy gate reads: document scores plus the two corpus ratios. */
export function buildScorecard(input: {
  claims: ClaimRecord[]
  scores: DocumentScore
  facets: Facet[]
  policy: InformationGainPolicy
  baselineAvailable: boolean
}): Scorecard {
  return {
    scores: {
      ...input.scores,
      consensusCoverage: input.baselineAvailable
        ? consensusCoverage(input.facets, input.claims)
        : null,
      internalDuplicationRate: input.baselineAvailable
        ? internalDuplicationRate(input.claims)
        : null,
    },
    claimSummary: buildClaimSummary(input.claims, input.scores, input.policy),
    baselineAvailable: input.baselineAvailable,
  }
}

/** Global Constraints: PASS→verified, REVISE→needs_revision, HUMAN_REVIEW→needs_review, BLOCK→blocked. */
export const DECISION_STATUS: Record<Decision, ArticleStatus> = Object.freeze({
  PASS: 'verified',
  REVISE: 'needs_revision',
  HUMAN_REVIEW: 'needs_review',
  BLOCK: 'blocked',
})

/** The statuses whose exit requires a reviewer to write a fresh justification. */
const REVIEW_STATUSES: ReadonlySet<ArticleStatus> = new Set<ArticleStatus>([
  'needs_review',
  'blocked',
])

export interface ArticleOutcomeInput {
  decision: Decision
  runId: number
  policyVersion: string
  scorecard: Scorecard
  totalCostUsd: number
  scoredAt: string
  /** Bookkeeping that failed without changing the decision; see `StageOutcome`. */
  warnings?: string[]
}

/**
 * The article write this stage returns.
 *
 * `reviewJustification` is cleared whenever the article lands in `needs_review`
 * or `blocked`: the override gate accepts a justification written for the
 * article's *current* problem, and a stale one left over from a previous
 * review would let a reviewer's earlier reasoning approve a scorecard they
 * never saw.
 */
export function articleOutcome(input: ArticleOutcomeInput): StageOutcome {
  const status = DECISION_STATUS[input.decision]
  const { scores, claimSummary } = input.scorecard
  const data: Partial<Article> = {
    informationGain: {
      run: input.runId,
      decision: input.decision,
      policyVersion: input.policyVersion,
      consensusCoverage: scores.consensusCoverage,
      verifiedGainUnits: scores.verifiedGainUnits,
      verificationRatio: scores.verificationRatio,
      internalDuplicationRate: scores.internalDuplicationRate,
      verifiedNovelClaims: claimSummary.verifiedNovelClaims,
      scoredAt: input.scoredAt,
    },
    totalCostUsd: input.totalCostUsd,
  }
  if (REVIEW_STATUSES.has(status)) data.reviewJustification = null
  return {
    status,
    data,
    ...(input.warnings?.length ? { warnings: input.warnings } : {}),
  }
}

/** The `information-gain-runs` create payload, minus the columns Payload fills in. */
export type InformationGainRunData = Omit<InformationGainRun, 'id' | 'createdAt' | 'updatedAt'>

export interface RunRowInput {
  articleId: number
  pipelineRunId: string
  snapshotId: number | null
  policyVersion: string
  policy: Record<string, unknown>
  models: Record<string, unknown>
  decision: Decision
  reasons: PolicyReason[]
  scorecard: Scorecard
  claims: ClaimRecord[]
  tokenCount: number
  costUsd: number
  draftUpdatedAt: string | null
}

/**
 * The immutable `information-gain-runs` row. The claim ids behind each
 * classification are stored explicitly because they are only derivable under
 * the policy that produced them — once a threshold moves, the stored scorecard
 * is the only record of which claims were novel, blocked, or verified.
 */
export function buildRunRow(input: RunRowInput): InformationGainRunData {
  const { scores, claimSummary, baselineAvailable } = input.scorecard
  return {
    article: input.articleId,
    pipelineRunId: input.pipelineRunId,
    snapshot: input.snapshotId,
    policyVersion: input.policyVersion,
    policy: input.policy,
    models: input.models,
    decision: input.decision,
    reasons: input.reasons,
    baselineAvailable,
    calibrated: false,
    scores: {
      consensusCoverage: scores.consensusCoverage,
      potentialGainUnits: scores.potentialGainUnits,
      verifiedGainUnits: scores.verifiedGainUnits,
      verificationRatio: scores.verificationRatio,
      verifiedGainDensity: scores.verifiedGainDensity,
      facetGainCoverage: scores.facetGainCoverage,
      internalDuplicationRate: scores.internalDuplicationRate,
    },
    claimSummary,
    claimIds: {
      blocked: scores.blockedClaimIds,
      review: scores.reviewClaimIds,
      materiallyNovel: scores.materiallyNovelClaimIds,
      verifiedNovel: scores.verifiedNovelClaimIds,
    },
    claims: input.claims,
    tokenCount: input.tokenCount,
    costUsd: input.costUsd,
    draftUpdatedAt: input.draftUpdatedAt,
  }
}
