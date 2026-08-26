/**
 * Information gain — facet weighting and coverage arithmetic.
 *
 * Consensus coverage answers "does the draft cover what the ranking corpus
 * treats as part of the answer?"; internal duplication answers "have we already
 * published this?". Both are pure ratios over signals produced elsewhere — the
 * per-claim probabilities they consume are uncalibrated LLM estimates, so the
 * ratios are uncalibrated too. Like the rest of
 * `cms/src/lib/informationGain/`, this file stays free of `next`, `react`,
 * `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

import type { Facet } from './types'

/** Negative or non-finite weights are treated as zero rather than throwing. */
const safeWeight = (w: number): number => (Number.isFinite(w) ? Math.max(0, w) : 0)

/**
 * How much each facet counts: the share of baseline documents covering it, so a
 * subtopic every competitor answers outweighs one only a single page mentions.
 * A `mustHave` facet is floored at 1 — the rubric marked it required, and a thin
 * baseline must not be able to discount it away.
 */
export function facetWeights(
  facets: { docCount: number; mustHave: boolean }[],
  totalDocs: number,
): number[] {
  const usableTotal = Number.isFinite(totalDocs) && totalDocs > 0 ? totalDocs : 0
  return facets.map((facet) => {
    if (usableTotal === 0) return 1
    const docCount = Number.isFinite(facet.docCount) ? Math.max(0, facet.docCount) : 0
    const weight = docCount / usableTotal
    return facet.mustHave ? Math.max(weight, 1) : weight
  })
}

/**
 * Weighted share of consensus facets at least one draft claim addresses. Null
 * when there are no facets, or when their weights sum to nothing — in both
 * cases there is no baseline to measure coverage against, which the policy gate
 * treats differently from measured-and-low coverage.
 */
export function consensusCoverage(
  facets: Facet[],
  claims: { facetId: string | null }[],
): number | null {
  if (facets.length === 0) return null

  const covered = new Set(
    claims.map((claim) => claim.facetId).filter((id): id is string => id != null),
  )

  let totalWeight = 0
  let coveredWeight = 0
  for (const facet of facets) {
    const weight = safeWeight(facet.weight)
    totalWeight += weight
    if (covered.has(facet.id)) coveredWeight += weight
  }

  return totalWeight > 0 ? coveredWeight / totalWeight : null
}

/**
 * Share of draft claims we have probably already published ourselves. The
 * per-claim probability is an uncalibrated LLM estimate, so the default
 * threshold is a deliberately blunt "the judge was fairly confident". Null when
 * there are no claims to measure.
 */
export function internalDuplicationRate(
  claims: { internalDuplicateProbability: number }[],
  threshold = 0.8,
): number | null {
  if (claims.length === 0) return null
  const duplicates = claims.filter(
    (claim) => claim.internalDuplicateProbability >= threshold,
  ).length
  return duplicates / claims.length
}
