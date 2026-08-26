/**
 * Information gain — the policy thresholds and the deterministic decision engine.
 *
 * `POLICY_FIELDS` is the single source of truth for the thresholds: the Payload
 * global's fields, the env overrides, `DEFAULT_POLICY`, and the admin copy are
 * all derived from it. Like the rest of `cms/src/lib/informationGain/`, this
 * file stays free of `next`, `react`, `payload`, `@/` aliases, `process.env`,
 * and `node:*` imports so the pipeline can import it directly.
 */

import {
  DECISION_RANK,
  isVerifiableClaimType,
  type ClaimRecord,
  type Decision,
  type PolicyReason,
  type Scorecard,
} from './types'

export type PolicyKind = 'ratio' | 'count' | 'boolean'

export interface PolicyFieldDef {
  key: string
  env: string
  default: number | boolean
  kind: PolicyKind
  /** The decision this threshold produces when it is breached. */
  outcome: Exclude<Decision, 'PASS'>
  description: string
}

export const POLICY_FIELDS = [
  {
    key: 'minConsensusCoverage',
    env: 'INFORMATION_GAIN_MIN_CONSENSUS_COVERAGE',
    default: 0.75,
    kind: 'ratio',
    outcome: 'REVISE',
    description: 'Weighted share of consensus facets the draft must cover.',
  },
  {
    key: 'minVerificationRatio',
    env: 'INFORMATION_GAIN_MIN_VERIFICATION_RATIO',
    default: 0.9,
    kind: 'ratio',
    outcome: 'BLOCK',
    description:
      "Verified gain units ÷ potential gain units; low values mean the draft's novelty rests on unsupported claims.",
  },
  {
    key: 'minNovelFactualIntegrity',
    env: 'INFORMATION_GAIN_MIN_NOVEL_FACTUAL_INTEGRITY',
    default: 0.9,
    kind: 'ratio',
    outcome: 'BLOCK',
    description:
      'Evidence integrity (support × source quality × exactness) required for a materially novel factual or inference claim.',
  },
  {
    key: 'minNumericTemporalIntegrity',
    env: 'INFORMATION_GAIN_MIN_NUMERIC_TEMPORAL_INTEGRITY',
    default: 0.95,
    kind: 'ratio',
    outcome: 'BLOCK',
    description:
      'Evidence integrity required for materially novel claims containing numbers, dates, or units.',
  },
  {
    key: 'requireExactValueMatch',
    env: 'INFORMATION_GAIN_REQUIRE_EXACT_VALUE_MATCH',
    default: true,
    kind: 'boolean',
    outcome: 'BLOCK',
    description:
      'Numeric or temporal values in a materially novel claim must match the cited evidence exactly.',
  },
  {
    key: 'requireEvidenceLineage',
    env: 'INFORMATION_GAIN_REQUIRE_EVIDENCE_LINEAGE',
    default: true,
    kind: 'boolean',
    outcome: 'BLOCK',
    description: 'Every materially novel verifiable claim must cite at least one evidence excerpt.',
  },
  {
    key: 'blockFirstPartyMeasurements',
    env: 'INFORMATION_GAIN_BLOCK_FIRST_PARTY_MEASUREMENTS',
    default: true,
    kind: 'boolean',
    outcome: 'BLOCK',
    description:
      'Drafts are model-generated, so any claimed first-party test, survey, or dataset is fabricated.',
  },
  {
    key: 'maxContradictionProbability',
    env: 'INFORMATION_GAIN_MAX_CONTRADICTION_PROBABILITY',
    default: 0.25,
    kind: 'ratio',
    outcome: 'HUMAN_REVIEW',
    description:
      'A claim contradicting reliable evidence at or above this probability needs a human decision (it may be legitimately new).',
  },
  {
    key: 'materialNoveltyThreshold',
    env: 'INFORMATION_GAIN_MATERIAL_NOVELTY_THRESHOLD',
    default: 0.55,
    kind: 'ratio',
    outcome: 'HUMAN_REVIEW',
    description:
      'Novelty at or above this makes a claim "materially novel"; a materially novel inference needs human review.',
  },
  {
    key: 'maxInternalDuplicationRate',
    env: 'INFORMATION_GAIN_MAX_INTERNAL_DUPLICATION_RATE',
    default: 0.35,
    kind: 'ratio',
    outcome: 'HUMAN_REVIEW',
    description:
      'Share of draft claims already published on this site at or above this triggers a consolidation review.',
  },
  {
    key: 'minVerifiedNovelClaims',
    env: 'INFORMATION_GAIN_MIN_VERIFIED_NOVEL_CLAIMS',
    default: 1,
    kind: 'count',
    outcome: 'REVISE',
    description: 'Minimum number of materially novel claims with verified evidence.',
  },
] as const satisfies readonly PolicyFieldDef[]

export type PolicyKey = (typeof POLICY_FIELDS)[number]['key']

export interface InformationGainPolicy {
  minConsensusCoverage: number
  minVerificationRatio: number
  minNovelFactualIntegrity: number
  minNumericTemporalIntegrity: number
  requireExactValueMatch: boolean
  requireEvidenceLineage: boolean
  blockFirstPartyMeasurements: boolean
  maxContradictionProbability: number
  materialNoveltyThreshold: number
  maxInternalDuplicationRate: number
  minVerifiedNovelClaims: number
}

/**
 * The table's defaults, keyed by field with each default's own type preserved.
 * Typing it this way rather than casting is what makes `DEFAULT_POLICY` below
 * a structural check: adding a POLICY_FIELDS entry without extending
 * `InformationGainPolicy` (or giving it a default of the wrong kind) becomes a
 * compile error instead of a value silently missing from the typed shape.
 */
type PolicyDefaults = {
  [F in (typeof POLICY_FIELDS)[number] as F['key']]: F['default']
}

const DEFAULTS_BY_KEY = Object.fromEntries(
  POLICY_FIELDS.map((field) => [field.key, field.default]),
) as PolicyDefaults

/**
 * Derived from POLICY_FIELDS so the table stays the one place a default lives.
 * Frozen because it is a shared module-level constant: callers spread it.
 */
export const DEFAULT_POLICY: InformationGainPolicy = Object.freeze(DEFAULTS_BY_KEY)

export type PolicySource = 'admin' | 'env' | 'default'

export interface ResolvedPolicy {
  policy: InformationGainPolicy
  sources: Record<PolicyKey, PolicySource>
  /** Deterministic JSON serialisation, hashed elsewhere into a policy version. */
  canonical: string
}

const TRUE_WORDS = new Set(['true', '1', 'yes'])
const FALSE_WORDS = new Set(['false', '0', 'no'])

/** Shared by the admin and env parsers so both read a boolean the same way. */
function parseBooleanWord(raw: string): boolean | undefined {
  const word = raw.trim().toLowerCase()
  if (TRUE_WORDS.has(word)) return true
  if (FALSE_WORDS.has(word)) return false
  return undefined
}

const validNumber = (value: number, kind: PolicyKind): boolean => {
  if (!Number.isFinite(value)) return false
  if (kind === 'count') return Number.isInteger(value) && value >= 0
  return value >= 0 && value <= 1
}

/** The admin value for a field, or undefined when it is absent or out of range. */
function fromAdmin(value: unknown, kind: PolicyKind): number | boolean | undefined {
  if (kind === 'boolean') {
    // The global stores the boolean gates as a clearable select ('true'/'false')
    // so that "unset" stays a visible, distinct state; a real boolean is
    // accepted too, for API callers and older stored docs.
    if (typeof value === 'boolean') return value
    return typeof value === 'string' ? parseBooleanWord(value) : undefined
  }
  if (typeof value !== 'number') return undefined
  return validNumber(value, kind) ? value : undefined
}

/** The env value for a field, or undefined when it is unset or unparseable. */
function fromEnv(raw: string | undefined, kind: PolicyKind): number | boolean | undefined {
  const text = raw?.trim()
  if (!text) return undefined
  if (kind === 'boolean') return parseBooleanWord(text)
  const value = Number(text)
  return validNumber(value, kind) ? value : undefined
}

function canonicalise(policy: InformationGainPolicy): string {
  const record: Record<string, number | boolean> = { schema: 1, ...policy }
  return JSON.stringify(record, Object.keys(record).sort())
}

/**
 * Thresholds resolve the same way models do: the Information Gain global wins,
 * then the env override, then the platform default. A value that is missing or
 * out of range for its kind falls through to the next source instead of
 * throwing, so a bad admin entry can never wedge the pipeline.
 */
export function resolvePolicy(
  globalDoc: Partial<Record<PolicyKey, unknown>> | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedPolicy {
  const policy = {} as Record<PolicyKey, number | boolean>
  const sources = {} as Record<PolicyKey, PolicySource>

  for (const field of POLICY_FIELDS) {
    const admin = fromAdmin(globalDoc?.[field.key], field.kind)
    if (admin !== undefined) {
      policy[field.key] = admin
      sources[field.key] = 'admin'
      continue
    }
    const envValue = fromEnv(env[field.env], field.kind)
    if (envValue !== undefined) {
      policy[field.key] = envValue
      sources[field.key] = 'env'
      continue
    }
    policy[field.key] = field.default
    sources[field.key] = 'default'
  }

  const resolved = policy as InformationGainPolicy
  return { policy: resolved, sources, canonical: canonicalise(resolved) }
}

export const POLICY_CODES = [
  'COVERAGE_BELOW_MIN',
  'VERIFICATION_RATIO_BELOW_MIN',
  'NOVEL_FACTUAL_CLAIM_REQUIRES_SUPPORT',
  'NUMERIC_CLAIM_REQUIRES_EXACT_SUPPORT',
  'EVIDENCE_LINEAGE_MISSING',
  'FIRST_PARTY_MEASUREMENT_PRESENT',
  'CONTRADICTION_REQUIRES_REVIEW',
  'NOVEL_INFERENCE_REQUIRES_REVIEW',
  'INTERNAL_DUPLICATION_REQUIRES_REVIEW',
  'NO_VERIFIED_NOVEL_CLAIM',
  'BASELINE_UNAVAILABLE',
] as const

export type PolicyCode = (typeof POLICY_CODES)[number]

/** The most severe outcome among the reasons; PASS when there are none. */
export function maxDecision(reasons: PolicyReason[]): Decision {
  return reasons.reduce<Decision>(
    (worst, reason) =>
      DECISION_RANK[reason.severity] > DECISION_RANK[worst] ? reason.severity : worst,
    'PASS',
  )
}

const ratio = (value: number): string => value.toFixed(2)

/** Keeps the first reason for each policy/claim pair. */
function dedupe(reasons: PolicyReason[]): PolicyReason[] {
  const seen = new Set<string>()
  return reasons.filter((reason) => {
    const key = `${reason.policy}|${reason.claimId ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * The gate itself: pure, deterministic, and the only place a decision is made.
 * Every triggered rule is reported; the decision is the most severe of them.
 */
export function decidePolicy(
  scorecard: Scorecard,
  claims: ClaimRecord[],
  policy: InformationGainPolicy,
): { decision: Decision; reasons: PolicyReason[] } {
  if (!scorecard.baselineAvailable) {
    const reasons: PolicyReason[] = [
      {
        policy: 'BASELINE_UNAVAILABLE',
        message: 'No baseline corpus was available; scoring skipped.',
        severity: 'HUMAN_REVIEW',
      },
    ]
    return { decision: maxDecision(reasons), reasons }
  }

  const { scores } = scorecard
  const reasons: PolicyReason[] = []

  if (scores.consensusCoverage != null && scores.consensusCoverage < policy.minConsensusCoverage) {
    reasons.push({
      policy: 'COVERAGE_BELOW_MIN',
      message: `Consensus coverage was ${ratio(scores.consensusCoverage)}; minimum is ${ratio(
        policy.minConsensusCoverage,
      )}.`,
      severity: 'REVISE',
    })
  }

  if (scores.verificationRatio < policy.minVerificationRatio && scores.potentialGainUnits > 0) {
    reasons.push({
      policy: 'VERIFICATION_RATIO_BELOW_MIN',
      message: `Verification ratio was ${ratio(scores.verificationRatio)}; minimum is ${ratio(
        policy.minVerificationRatio,
      )}.`,
      severity: 'BLOCK',
    })
  }

  for (const claim of claims) {
    reasons.push(...claim.scored.reasons)

    const materiallyNovel = claim.novelty >= policy.materialNoveltyThreshold
    if (
      policy.requireEvidenceLineage &&
      isVerifiableClaimType(claim.kind) &&
      materiallyNovel &&
      claim.evidence.length === 0 &&
      claim.verificationMode === 'verified'
    ) {
      reasons.push({
        policy: 'EVIDENCE_LINEAGE_MISSING',
        claimId: claim.id,
        message: `Claim ${claim.id} is materially novel but cites no evidence.`,
        severity: 'BLOCK',
      })
    }

    if (policy.blockFirstPartyMeasurements && claim.kind === 'first_party_measurement') {
      reasons.push({
        policy: 'FIRST_PARTY_MEASUREMENT_PRESENT',
        claimId: claim.id,
        message: `Claim ${claim.id} asserts a first-party measurement, which a model-generated draft cannot have produced.`,
        severity: 'BLOCK',
      })
    }
  }

  if (
    scores.internalDuplicationRate != null &&
    scores.internalDuplicationRate >= policy.maxInternalDuplicationRate
  ) {
    reasons.push({
      policy: 'INTERNAL_DUPLICATION_REQUIRES_REVIEW',
      message: `Internal duplication rate was ${ratio(
        scores.internalDuplicationRate,
      )}; maximum is ${ratio(policy.maxInternalDuplicationRate)}.`,
      severity: 'HUMAN_REVIEW',
    })
  }

  if (scores.verifiedNovelClaimIds.length < policy.minVerifiedNovelClaims) {
    reasons.push({
      policy: 'NO_VERIFIED_NOVEL_CLAIM',
      message: `Only ${scores.verifiedNovelClaimIds.length} materially novel claim(s) were verified; minimum is ${policy.minVerifiedNovelClaims}.`,
      severity: 'REVISE',
    })
  }

  const deduped = dedupe(reasons)
  return { decision: maxDecision(deduped), reasons: deduped }
}
