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
