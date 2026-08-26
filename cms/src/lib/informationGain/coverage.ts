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

/** A baseline-document total we can divide by, or 0 meaning "we cannot". */
const usableTotalOf = (totalDocs: number): number =>
  Number.isFinite(totalDocs) && totalDocs > 0 ? totalDocs : 0

/**
 * The weighting rule itself, in one place: `facetWeights` and
 * `applyTemplateHints` both call it so the formula cannot fork. `usableTotal`
 * is pre-validated by `usableTotalOf`; 0 means there is nothing to divide by,
 * in which case every facet counts the same.
 */
function weightOf(facet: { docCount: number; mustHave: boolean }, usableTotal: number): number {
  if (usableTotal === 0) return 1
  const docCount = Number.isFinite(facet.docCount) ? Math.max(0, facet.docCount) : 0
  const weight = docCount / usableTotal
  return facet.mustHave ? Math.max(weight, 1) : weight
}

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
  const usableTotal = usableTotalOf(totalDocs)
  return facets.map((facet) => weightOf(facet, usableTotal))
}

/** The comparison `parseFacetClustering` uses to match a facet to a template heading. */
const normaliseHint = (value: string): string => value.trim().toLowerCase()

/**
 * Re-derives `mustHave` — and the `weight` that depends on it — against one
 * article's template headings.
 *
 * A snapshot is keyed by (keyword, country), not by template, so the flags
 * baked in when it was built belong to whichever article triggered the build. A
 * second article on the same keyword with a different template must be graded —
 * and prompted — against its own required sections, so the consumer re-applies
 * its own headings before using the facets.
 *
 * `weight` is recomputed rather than carried over, because `weightOf` floors a
 * `mustHave` facet at 1: a stored weight of 1 next to a re-derived
 * `mustHave: false` would keep a floor the consuming template never justified,
 * and `consensusCoverage` reads `facet.weight` directly. Both flags come out of
 * one pass so they cannot disagree. `docCount` is untouched — it is a property
 * of the corpus, not of the template — and `totalDocs` is the snapshot's
 * `baselineDocCount`.
 */
export function applyTemplateHints<
  T extends {
    label: string
    mustHave: boolean
    docCount: number
    weight: number
    matchesHint?: string | null
  },
>(facets: T[], headings: string[], totalDocs: number): T[] {
  const wanted = new Set(headings.map(normaliseHint).filter((heading) => heading !== ''))
  const usableTotal = usableTotalOf(totalDocs)
  return facets.map((facet) => {
    const mustHave =
      wanted.has(normaliseHint(facet.matchesHint ?? '')) || wanted.has(normaliseHint(facet.label))
    return {
      ...facet,
      mustHave,
      weight: weightOf({ docCount: facet.docCount, mustHave }, usableTotal),
    }
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
