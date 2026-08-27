/**
 * Information gain — how much a cited source is allowed to count for.
 *
 * Two ways a URL earns a score: the admin's evidence-sources table (an explicit
 * human decision about a domain) or the judge's rubric class. A rubric class is
 * capped at `UNKNOWN_DOMAIN_CAP` because it is an uncalibrated model guess about
 * a domain nobody has vetted, and `first_party_dataset` can never come from the
 * rubric at all — only the table can certify a source as our own. Like the rest
 * of `cms/src/lib/informationGain/`, this file stays free of `next`, `react`,
 * `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

import type { QualitySource, SourceQualityClass } from './types'

/** 0–1 quality multiplier per class. Uncalibrated: a policy dial, not a probability. */
export const SOURCE_QUALITY_SCORE: Record<SourceQualityClass, number> = {
  first_party_dataset: 1,
  primary: 0.95,
  official_docs: 0.9,
  secondary: 0.75,
  unverified: 0.4,
  blocked: 0,
}

/** Ceiling for a domain nobody has vetted in the evidence-sources table. */
export const UNKNOWN_DOMAIN_CAP = 0.75

/** One row of the admin's evidence-sources table. */
export interface EvidenceSourceRule {
  domain: string
  qualityClass: SourceQualityClass
  active: boolean
}

/**
 * Reduces anything domain-shaped — a bare hostname, a full URL, a pasted link
 * with credentials and a port — to a comparable hostname. Used by the
 * evidence-sources collection to store one canonical form per row, and here to
 * compare a rule against a URL. Returns `''` when nothing usable is left.
 */
export function normaliseDomain(input: string): string {
  let value = input.trim().toLowerCase()
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  value = value.replace(/^\/\//, '')
  value = value.split(/[/?#]/)[0] ?? ''
  const credentials = value.lastIndexOf('@')
  if (credentials >= 0) value = value.slice(credentials + 1)
  value = value.replace(/:\d+$/, '')
  value = value.replace(/^www\./, '')
  value = value.replace(/\.+$/, '')
  return value
}

/** The hostname of a real URL, `www.` stripped; null when it will not parse. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** `docs.example.com` matches the rule `example.com`; `notexample.com` does not. */
const matchesDomain = (hostname: string, domain: string): boolean =>
  hostname === domain || hostname.endsWith(`.${domain}`)

/**
 * The active rule covering a hostname, or null when nobody has rated it.
 *
 * Separate from `resolveSourceQuality` because two callers need the *question*
 * rather than the score: the candidate collector, which drops a domain that is
 * already rated, and the review page, which re-checks pending candidates against
 * the live rules so a hand-written or deactivated rule takes effect with no
 * write of its own.
 */
export function matchEvidenceRule(
  hostname: string,
  rules: EvidenceSourceRule[],
): EvidenceSourceRule | null {
  let best: { rule: EvidenceSourceRule; length: number } | null = null
  for (const rule of rules) {
    if (!rule.active) continue
    const domain = normaliseDomain(rule.domain)
    if (domain === '' || !matchesDomain(hostname, domain)) continue
    // Longest match wins, so a specific subdomain rule beats its parent domain.
    if (best === null || domain.length > best.length) best = { rule, length: domain.length }
  }
  return best?.rule ?? null
}

/**
 * The score one cited URL carries, and where that score came from. A URL we
 * cannot even parse scores 0 — an unusable citation is not evidence.
 */
export function resolveSourceQuality(
  url: string,
  rules: EvidenceSourceRule[],
  rubricClass: SourceQualityClass | 'unknown',
): { score: number; source: QualitySource; matchedRule: string | null } {
  const hostname = hostnameOf(url)
  if (hostname === null) return { score: 0, source: 'rubric', matchedRule: null }

  const matched = matchEvidenceRule(hostname, rules)

  if (matched !== null) {
    return {
      // ?? 0 because a hand-written or imported row can carry a class outside
      // the enum; undefined here would become NaN evidence integrity, which
      // compares false against every floor and would silently pass the gates.
      score: SOURCE_QUALITY_SCORE[matched.qualityClass] ?? 0,
      source: 'evidence-sources',
      matchedRule: matched.domain,
    }
  }

  const base =
    rubricClass === 'unknown' || rubricClass === 'first_party_dataset'
      ? SOURCE_QUALITY_SCORE.unverified
      : SOURCE_QUALITY_SCORE[rubricClass]
  const score = Math.min(base, UNKNOWN_DOMAIN_CAP)
  return { score, source: score < base ? 'rubric_capped' : 'rubric', matchedRule: null }
}
