/**
 * Information gain — claim and document scoring.
 *
 * Pure arithmetic over the LLM's per-claim signals: no I/O, no randomness, and
 * no `next`/`react`/`payload`/`@/`/`process.env`/`node:*` imports, so the CMS
 * and the pipeline both import it directly. Every 0–1 signal it consumes is an
 * uncalibrated LLM estimate, so the scores it produces are uncalibrated too —
 * they rank claims within a draft, they are not probabilities.
 */

import {
  isVerifiableClaimType,
  type ClaimSignals,
  type DocumentScore,
  type Facet,
  type PolicyReason,
  type QueryClusterEntry,
  type ScoredClaim,
} from './types'
import type { InformationGainPolicy } from './policy'

/** Weights of the utility rubric; they sum to 1 so a perfect rubric scores 1. */
export const UTILITY_WEIGHTS = {
  specificity: 0.3,
  actionability: 0.25,
  explanatoryPower: 0.25,
  audienceFit: 0.2,
} as const

/** Verified gain a single claim must deliver for its facet to count as covered. */
export const FACET_GAIN_THRESHOLD = 0.1

/** Importance is a multiplier, not a 0–1 signal: 1 is neutral. */
export const IMPORTANCE_RANGE = { min: 0.5, max: 2 } as const

/** Coerces any number into 0–1; non-finite input scores 0 rather than throwing. */
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0))

/** Coerces any number into the importance range; non-finite input takes the minimum. */
export function clampImportance(v: number): number {
  const value = Number.isFinite(v) ? v : IMPORTANCE_RANGE.min
  return Math.max(IMPORTANCE_RANGE.min, Math.min(IMPORTANCE_RANGE.max, value))
}

export function utilityFromRubric(r: {
  specificity: number
  actionability: number
  explanatoryPower: number
  audienceFit: number
}): number {
  return (
    clamp01(r.specificity) * UTILITY_WEIGHTS.specificity +
    clamp01(r.actionability) * UTILITY_WEIGHTS.actionability +
    clamp01(r.explanatoryPower) * UTILITY_WEIGHTS.explanatoryPower +
    clamp01(r.audienceFit) * UTILITY_WEIGHTS.audienceFit
  )
}

/**
 * Relevance across the query cluster: Σ w_q · r_q. A query the judge did not
 * score contributes nothing. The cluster's weights are meant to sum to 1; the
 * result is clamped so a malformed cluster cannot push relevance above 1.
 */
export function relevanceFromQueries(
  relevanceByQuery: Record<string, number>,
  cluster: QueryClusterEntry[],
): number {
  const total = cluster.reduce((sum, query) => {
    const weight = Number.isFinite(query.weight) ? Math.max(0, query.weight) : 0
    return sum + weight * clamp01(relevanceByQuery[query.id] ?? 0)
  }, 0)
  return clamp01(total)
}

/** Rough token count for gain density; good enough to compare drafts, not a tokenizer. */
export function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words * 1.3))
}

/**
 * How trustworthy a claim's evidence must be before its novelty counts. Numbers,
 * dates, and claimed first-party measurements are held to the stricter floor.
 */
function evidenceFloorFor(
  kind: ClaimSignals['kind'],
  numeric: boolean,
  policy: InformationGainPolicy,
): number {
  if (numeric || kind === 'first_party_measurement') return policy.minNumericTemporalIntegrity
  return isVerifiableClaimType(kind) ? policy.minNovelFactualIntegrity : 0.75
}

const ratio = (value: number): string => value.toFixed(2)

export function scoreClaim(s: ClaimSignals, policy: InformationGainPolicy): ScoredClaim {
  const novelty = clamp01(s.novelty)
  const relevance = clamp01(s.relevance)
  const utility = clamp01(s.utility)
  const intraDocumentNovelty = clamp01(s.intraDocumentNovelty)
  const exactness = clamp01(s.exactness)
  const contradictionProbability = clamp01(s.contradictionProbability)

  const potentialGain = novelty * relevance * utility * intraDocumentNovelty
  const evidenceIntegrity = clamp01(s.evidenceSupport) * clamp01(s.sourceQuality) * exactness

  const isVerifiable = isVerifiableClaimType(s.kind)
  const isMateriallyNovel = novelty >= policy.materialNoveltyThreshold
  const evidenceFloor = evidenceFloorFor(s.kind, s.containsNumericOrTemporalClaim, policy)

  const integrityTooLow = evidenceIntegrity < evidenceFloor
  const valuesDoNotMatch =
    s.containsNumericOrTemporalClaim && policy.requireExactValueMatch && exactness < 1
  const blocked =
    isVerifiable &&
    isMateriallyNovel &&
    s.verificationMode === 'verified' &&
    (integrityTooLow || valuesDoNotMatch)

  const reasons: PolicyReason[] = []
  if (blocked) {
    reasons.push({
      policy: s.containsNumericOrTemporalClaim
        ? 'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT'
        : 'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT',
      claimId: s.id,
      message: integrityTooLow
        ? `Evidence integrity was ${ratio(evidenceIntegrity)}; minimum is ${ratio(evidenceFloor)}.`
        : 'Numeric or temporal values do not exactly match the evidence.',
      severity: 'BLOCK',
    })
  }

  const contradicts = contradictionProbability >= policy.maxContradictionProbability
  if (contradicts) {
    reasons.push({
      policy: 'CONTRADICTION_REQUIRES_REVIEW',
      claimId: s.id,
      message: `Contradiction probability was ${ratio(
        contradictionProbability,
      )}; maximum is ${ratio(policy.maxContradictionProbability)}.`,
      severity: 'HUMAN_REVIEW',
    })
  }

  const novelInference = s.kind === 'inference' && isMateriallyNovel
  if (novelInference) {
    reasons.push({
      policy: 'NOVEL_INFERENCE_REQUIRES_REVIEW',
      claimId: s.id,
      message: 'Materially novel inference requires human review.',
      severity: 'HUMAN_REVIEW',
    })
  }

  return {
    id: s.id,
    potentialGain,
    verifiedGain: blocked ? 0 : potentialGain * evidenceIntegrity,
    evidenceIntegrity,
    blocked,
    requiresHumanReview: contradicts || novelInference,
    reasons,
  }
}

export function scoreDocument(
  claims: ClaimSignals[],
  tokenCount: number,
  policy: InformationGainPolicy,
  facets: Facet[],
  facetOf: (claimId: string) => string | null,
): DocumentScore {
  const tokens = Math.max(1, Number.isFinite(tokenCount) ? tokenCount : 1)

  const scored = claims.map((claim) => ({ claim, scored: scoreClaim(claim, policy) }))

  let potentialGainUnits = 0
  let verifiedGainUnits = 0
  const blockedClaimIds: string[] = []
  const reviewClaimIds: string[] = []
  const materiallyNovelClaimIds: string[] = []
  const verifiedNovelClaimIds: string[] = []
  /** Best verified gain any single claim delivers to each facet. */
  const bestGainByFacet = new Map<string, number>()

  for (const { claim, scored: score } of scored) {
    const importance = clampImportance(claim.importance)
    potentialGainUnits += importance * score.potentialGain
    verifiedGainUnits += importance * score.verifiedGain

    if (score.blocked) blockedClaimIds.push(claim.id)
    if (score.requiresHumanReview) reviewClaimIds.push(claim.id)

    const facetId = facetOf(claim.id)
    if (facetId != null) {
      bestGainByFacet.set(facetId, Math.max(bestGainByFacet.get(facetId) ?? 0, score.verifiedGain))
    }

    if (clamp01(claim.novelty) >= policy.materialNoveltyThreshold) {
      materiallyNovelClaimIds.push(claim.id)
      const floor = evidenceFloorFor(claim.kind, claim.containsNumericOrTemporalClaim, policy)
      if (
        !score.blocked &&
        score.verifiedGain > 0 &&
        claim.verificationMode === 'verified' &&
        score.evidenceIntegrity >= floor
      ) {
        verifiedNovelClaimIds.push(claim.id)
      }
    }
  }

  const facetWeight = facets.reduce(
    (sum, facet) => sum + (Number.isFinite(facet.weight) ? Math.max(0, facet.weight) : 0),
    0,
  )
  const coveredWeight = facets.reduce((sum, facet) => {
    const weight = Number.isFinite(facet.weight) ? Math.max(0, facet.weight) : 0
    const best = bestGainByFacet.get(facet.id) ?? 0
    return best >= FACET_GAIN_THRESHOLD ? sum + weight : sum
  }, 0)

  return {
    potentialGainUnits,
    verifiedGainUnits,
    verificationRatio: potentialGainUnits > 0 ? verifiedGainUnits / potentialGainUnits : 0,
    verifiedGainDensity: verifiedGainUnits / (tokens / 1000),
    facetGainCoverage: facetWeight > 0 ? coveredWeight / facetWeight : null,
    blockedClaimIds,
    reviewClaimIds,
    materiallyNovelClaimIds,
    verifiedNovelClaimIds,
  }
}
