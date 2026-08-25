/**
 * Information gain — shared claim, evidence, and scorecard types.
 *
 * Imported by both the CMS (the Information Gain global, the admin view) and
 * the pipeline (`pipeline/src/informationGain/lib.ts` re-exports the barrel via
 * a relative path), so this file — and everything else under
 * `cms/src/lib/informationGain/` — must stay free of `next`, `react`, `payload`
 * runtime imports, `@/` aliases, `process.env`, and `node:*` imports.
 */

import type { PolicyCode } from './policy'

/** What kind of assertion a claim makes. Drives which gates apply to it. */
export const CLAIM_TYPES = [
  'factual',
  'first_party_measurement',
  'inference',
  'recommendation',
  'opinion',
  'definition',
  'comparison',
  'prediction',
] as const

export type ClaimType = (typeof CLAIM_TYPES)[number]

/** Claim types that can be checked against outside evidence. */
export const VERIFIABLE_CLAIM_TYPES: readonly ClaimType[] = [
  'factual',
  'first_party_measurement',
  'inference',
]

export function isVerifiableClaimType(t: ClaimType): boolean {
  return VERIFIABLE_CLAIM_TYPES.includes(t)
}

/** One query the draft is scored against: the target keyword and its related questions. */
export interface QueryClusterEntry {
  id: string
  text: string
  kind: 'keyword' | 'related_question'
  /** Share of the cluster this query carries; the cluster's weights are meant to sum to 1. */
  weight: number
}

/** A subtopic the ranking corpus treats as part of the answer. */
export interface Facet {
  id: string
  label: string
  description: string
  weight: number
  /** How many baseline documents cover this facet. */
  docCount: number
  mustHave: boolean
  claimIds: string[]
}

/** A facet (or free-standing angle) the baseline corpus leaves unanswered. */
export interface InformationGap {
  facetId: string | null
  label: string
  description: string
  evidenceHint: string
}

export interface BaselineClaimSource {
  kind: 'serp' | 'internal'
  docId: string
  url?: string
  articleId?: number
}

/** A claim extracted from the baseline corpus (SERP competitors or our own articles). */
export interface BaselineClaim {
  id: string
  text: string
  type: ClaimType
  excerpt: string
  entities: string[]
  values: string[]
  source: BaselineClaimSource
  facetId: string | null
}

/** A claim extracted from the draft under review. */
export interface DraftClaim {
  id: string
  text: string
  type: ClaimType
  excerpt: string
  section: string | null
  facetId: string | null
  entities: string[]
  values: string[]
  /** The baseline claim this one merely restates, when it does. */
  restatesClaimId: string | null
  /** Whether `excerpt` was found verbatim in the draft body. */
  excerptFound: boolean
}

export const SOURCE_QUALITY_CLASSES = [
  'first_party_dataset',
  'primary',
  'official_docs',
  'secondary',
  'unverified',
  'blocked',
] as const

export type SourceQualityClass = (typeof SOURCE_QUALITY_CLASSES)[number]

/** Where a source's quality score came from: the admin table, the rubric, or a capped rubric score. */
export type QualitySource = 'evidence-sources' | 'rubric' | 'rubric_capped'

export interface Evidence {
  url: string
  excerpt: string
  publisher: string | null
  sourceKind: SourceQualityClass | 'unknown'
  domain: string
  /** 0–1, uncalibrated. */
  qualityScore: number
  qualitySource: QualitySource
}

/** How hard a claim was actually checked. Only `verified` claims can be blocked. */
export type VerificationMode =
  'verified' | 'baseline_corroborated' | 'not_applicable' | 'skipped_no_baseline'

/** All 0–1 signals are uncalibrated LLM estimates (handoff §25 calibration is deferred). */
export interface ClaimSignals {
  id: string
  kind: ClaimType
  /** 0.5–2.0 importance to the target intent. */
  importance: number
  novelty: number
  relevance: number
  utility: number
  intraDocumentNovelty: number
  evidenceSupport: number
  sourceQuality: number
  exactness: number
  contradictionProbability: number
  containsNumericOrTemporalClaim: boolean
  verificationMode: VerificationMode
  calibrated: false
}

export type Decision = 'PASS' | 'REVISE' | 'HUMAN_REVIEW' | 'BLOCK'

/** Decision precedence: BLOCK > HUMAN_REVIEW > REVISE > PASS. */
export const DECISION_RANK: Record<Decision, number> = {
  PASS: 0,
  REVISE: 1,
  HUMAN_REVIEW: 2,
  BLOCK: 3,
}

export interface PolicyReason {
  policy: PolicyCode
  claimId?: string
  message: string
  severity: Exclude<Decision, 'PASS'>
}

/** The scored outcome for one claim. All scores are uncalibrated. */
export interface ScoredClaim {
  id: string
  potentialGain: number
  verifiedGain: number
  evidenceIntegrity: number
  blocked: boolean
  requiresHumanReview: boolean
  reasons: PolicyReason[]
}

/** A claim with its signals, evidence, judge output, and score in one record. */
export interface ClaimRecord extends ClaimSignals {
  text: string
  excerpt: string
  section: string | null
  facetId: string | null
  closestBaselineClaimId: string | null
  closestInternalClaimId: string | null
  /** 0–1, uncalibrated: how likely this claim is already published on our own site. */
  internalDuplicateProbability: number
  evidence: Evidence[]
  exactnessMismatches: string[]
  judgeRationale: string
  verifierNotes: string | null
  scored: ScoredClaim
}

/** Document-level roll-up of the per-claim scores. All scores are uncalibrated. */
export interface DocumentScore {
  potentialGainUnits: number
  verifiedGainUnits: number
  verificationRatio: number
  /** Verified gain units per 1,000 draft tokens. */
  verifiedGainDensity: number
  facetGainCoverage: number | null
  blockedClaimIds: string[]
  reviewClaimIds: string[]
  materiallyNovelClaimIds: string[]
  verifiedNovelClaimIds: string[]
}

export interface ClaimSummary {
  totalClaims: number
  materiallyNovelClaims: number
  verifiedNovelClaims: number
  unsupportedNovelClaims: number
  contradictoryClaims: number
  firstPartyClaims: number
}

/** The full information-gain result for one draft. All scores are uncalibrated. */
export interface Scorecard {
  scores: DocumentScore & {
    /** Weighted share of consensus facets the draft covers; null when no facets were derived. */
    consensusCoverage: number | null
    /** Share of draft claims already published on our own site; null when no internal corpus. */
    internalDuplicationRate: number | null
  }
  claimSummary: ClaimSummary
  baselineAvailable: boolean
}
