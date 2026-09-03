/**
 * Pure parsers for the QA LLM verdicts. No LLM/Payload imports so they are
 * unit-testable and the pass/fail rule lives in one place.
 */

export interface FactCheckVerdict {
  passed: boolean
  notes: string
  sources: string[]
}

export interface NotTraitViolation {
  trait: string
  excerpt: string
  explanation: string
}

export interface QualitativeVerdict {
  passed: boolean
  notes: string
  /** Brand voice fit 1–5; null when no brand voice was active or the model omitted it. */
  voiceScore: number | null
  voiceNotes: string | null
  /** Clear breaches of a "what we are NOT" trait. Any entry fails the article. */
  notTraitViolations: NotTraitViolation[]
}

export function parseFactCheck(json: unknown): FactCheckVerdict {
  const record = json as Record<string, unknown>
  if (typeof record?.passed !== 'boolean' || typeof record?.notes !== 'string') {
    throw new Error('factCheck verdict must have boolean "passed" and string "notes"')
  }
  const sources = Array.isArray(record.sources)
    ? record.sources.filter((s): s is string => typeof s === 'string')
    : []
  return { passed: record.passed, notes: record.notes, sources }
}

function parseVoiceScore(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return Math.min(5, Math.max(1, Math.round(value)))
}

function parseNotTraitViolations(value: unknown): NotTraitViolation[] {
  if (!Array.isArray(value)) return []
  const violations: NotTraitViolation[] = []
  for (const item of value) {
    const v = item as Record<string, unknown>
    // The "clear violation" bar: the model must quote the offending text.
    if (typeof v?.excerpt !== 'string' || v.excerpt.trim() === '') continue
    violations.push({
      trait: typeof v.trait === 'string' ? v.trait : '',
      excerpt: v.excerpt.trim(),
      explanation: typeof v.explanation === 'string' ? v.explanation : '',
    })
  }
  return violations
}

/** Accepts both the legacy `{passed, notes}` shape and the brand-voice-aware one. */
export function parseQualitative(json: unknown): QualitativeVerdict {
  const record = json as Record<string, unknown>
  if (typeof record?.passed !== 'boolean' || typeof record?.notes !== 'string') {
    throw new Error('qualitativeReview verdict must have boolean "passed" and string "notes"')
  }
  return {
    passed: record.passed,
    notes: record.notes,
    voiceScore: parseVoiceScore(record.voiceScore),
    voiceNotes: typeof record.voiceNotes === 'string' && record.voiceNotes ? record.voiceNotes : null,
    notTraitViolations: parseNotTraitViolations(record.notTraitViolations),
  }
}

/** voiceScore is informational; only the editor's verdict and clear not-trait breaches gate QA. */
export function decideQualitative(verdict: QualitativeVerdict): boolean {
  return verdict.passed && verdict.notTraitViolations.length === 0
}

// ---------------------------------------------------------------------------
// Evidence check
// ---------------------------------------------------------------------------

/** What the evidence check concluded about one first-party sentence. */
export type EvidenceClaimStatus = 'backed' | 'overreach' | 'unbacked' | 'rejected'

/**
 * `unusable` is never returned by the model. It is what `decideEvidence` adds
 * for a ref the deterministic half found unknown or expired, so the review view
 * and the revision notes have one list to read rather than two.
 */
export type EvidenceFindingStatus = EvidenceClaimStatus | 'unusable'

export interface EvidenceClaimFinding {
  excerpt: string
  kind: 'first_party' | 'competitor'
  status: EvidenceFindingStatus
  /** The bank entry the sentence leans on, when there is one. */
  ref: string | null
  note: string
  /** What to say instead, from the bank's rejected row. Only set for `rejected`. */
  replacement?: string
}

export interface EvidenceCheckVerdict {
  claims: EvidenceClaimFinding[]
  notes: string
}

const CLAIM_STATUSES: readonly string[] = ['backed', 'overreach', 'unbacked', 'rejected']

/**
 * Parse the model's evidence verdict.
 *
 * A finding without a verbatim excerpt is dropped, for the same reason
 * `parseNotTraitViolations` drops one: the whole value of the finding is that a
 * reviewer can find the sentence, and "the article overstates performance
 * somewhere" is an unfixable complaint. An unrecognised status is dropped too
 * rather than defaulted — guessing `unbacked` would flag a sentence nobody
 * judged, and guessing `backed` would clear one.
 */
export function parseEvidenceCheck(json: unknown): EvidenceCheckVerdict {
  const record = json as Record<string, unknown> | null
  const claims: EvidenceClaimFinding[] = []
  const raw = Array.isArray(record?.claims) ? record.claims : []
  for (const item of raw) {
    const v = item as Record<string, unknown>
    const excerpt = typeof v?.excerpt === 'string' ? v.excerpt.trim() : ''
    if (excerpt === '') continue
    const status = typeof v.status === 'string' ? v.status : ''
    if (!CLAIM_STATUSES.includes(status)) continue
    const ref = typeof v.ref === 'string' && v.ref.trim() !== '' ? v.ref.trim() : null
    claims.push({
      excerpt,
      kind: v.kind === 'competitor' ? 'competitor' : 'first_party',
      status: status as EvidenceClaimStatus,
      ref,
      note: typeof v.note === 'string' ? v.note : '',
    })
  }
  return { claims, notes: typeof record?.notes === 'string' ? record.notes : '' }
}

/** The deterministic half's answer, as `checkEvidenceRefs` returns it. */
export interface EvidenceRefFindings {
  unknown: string[]
  unusable: { ref: string; reason: string }[]
}

export interface EvidenceDecision {
  passed: boolean
  findings: EvidenceClaimFinding[]
}

/**
 * Fold the model's findings and the ref check into one verdict.
 *
 * The severity ladder is the whole policy, and it is deliberately asymmetric:
 *
 * - `rejected` and `unusable` **fail**. A claim somebody has already ruled out,
 *   or a citation pointing at nothing, is a defect with a known answer.
 * - `overreach` **fails**. A verified claim stretched past its limits is worse
 *   than no claim at all, because it arrives wearing the authority of the
 *   evidence it just left behind.
 * - `unbacked` **flags**. Plenty of true sentences about a company are not in
 *   the bank yet, and failing them would make the bank a precondition for
 *   writing rather than a guarantee about what is written.
 * - `backed` is recorded, so the reviewer can see the draft did the work.
 */
export function decideEvidence(
  verdict: EvidenceCheckVerdict,
  deterministic: EvidenceRefFindings,
): EvidenceDecision {
  const findings: EvidenceClaimFinding[] = [
    ...verdict.claims,
    ...deterministic.unknown.map((ref) => ({
      excerpt: `[${ref}]`,
      kind: 'first_party' as const,
      status: 'unusable' as const,
      ref,
      note: 'No such entry in the evidence bank.',
    })),
    ...deterministic.unusable.map(({ ref, reason }) => ({
      excerpt: `[${ref}]`,
      kind: 'first_party' as const,
      status: 'unusable' as const,
      ref,
      note: `Cited an entry that may not be used — ${reason}.`,
    })),
  ]
  const failed = findings.some(
    (finding) =>
      finding.status === 'rejected' ||
      finding.status === 'unusable' ||
      finding.status === 'overreach',
  )
  return { passed: !failed, findings }
}

/** Which findings send an article back, in the order a writer should fix them. */
export function failingEvidenceFindings(
  findings: EvidenceClaimFinding[],
): EvidenceClaimFinding[] {
  const order: Record<string, number> = { rejected: 0, unusable: 1, overreach: 2 }
  return findings
    .filter((finding) => finding.status in order)
    .sort((a, b) => order[a.status] - order[b.status])
}

/**
 * The failing findings as instructions a regeneration can act on.
 *
 * Appended to `qaResults.evidenceCheck.notes`, which is what the reviewer's
 * regenerate action turns into the `# Revision notes` block. The excerpt is the
 * point: "remove the unsupported claim" is unactionable, and the same draft
 * comes back with the same sentence in it.
 */
export function evidenceRevisionNotes(findings: EvidenceClaimFinding[]): string {
  return failingEvidenceFindings(findings)
    .map((finding) => {
      const use = finding.replacement
        ? `, use ${finding.replacement}`
        : finding.status === 'overreach' && finding.ref
          ? `, use [${finding.ref}] only within its stated limits`
          : ''
      return `Remove or replace: ${finding.excerpt} (${finding.status}${use})`
    })
    .join('\n')
}
