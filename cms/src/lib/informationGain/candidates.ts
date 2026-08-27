/**
 * Information gain — collecting the domains nobody has rated yet.
 *
 * An unrated domain is capped at `UNKNOWN_DOMAIN_CAP` (0.75), which clears
 * neither novel-claim floor, so a draft whose value rests on one is blocked with
 * nothing to show for it. These helpers turn that silent outcome into a queue:
 * every domain the verifier cited without a matching rule, plus every domain
 * ranking in the article's own SERP snapshot, becomes a candidate somebody can
 * rate once. Nothing here decides anything — a candidate carries a *suggested*
 * class, and the suggestion deliberately cannot reach a class strong enough to
 * clear a floor on its own (see `suggestClass`).
 *
 * Like the rest of `cms/src/lib/informationGain/`, this file stays free of
 * `next`, `react`, `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

import { matchEvidenceRule, normaliseDomain, type EvidenceSourceRule } from './sourceQuality'
import type { ClaimRecord, SourceQualityClass } from './types'

/**
 * The classes a suggestion may take. `first_party_dataset` is absent because
 * only a human can certify a source as our own, and `blocked` because a default
 * should never be "shut this domain out" — both remain choosable in the UI.
 */
export const CANDIDATE_CLASSES = ['primary', 'official_docs', 'secondary', 'unverified'] as const

export type CandidateClass = (typeof CANDIDATE_CLASSES)[number]

/** How many sightings one candidate row keeps. Newest first; the rest are counts. */
export const MAX_CANDIDATE_SIGHTINGS = 25

/** Domain rating at or above which a SERP-only domain is suggested `secondary`. */
export const SERP_SECONDARY_MIN_DR = 40

export type CandidateKind = 'cited' | 'serp'

/** One time a domain turned up, in one article's scoring run. */
export interface CandidateSighting {
  domain: string
  kind: CandidateKind
  articleId: number
  keyword: string
  runId: number
  seenAt: string
  url: string
  /** cited: how many of this run's citations pointed at this domain. */
  citations?: number
  /** cited: the verifier's own rubric guess, the best hint we have for a suggestion. */
  sourceKind?: SourceQualityClass | 'unknown'
  /** serp: best position this domain held for the keyword. */
  position?: number
  /** serp: Ahrefs domain rating, when the SERP row carried one. */
  domainRating?: number | null
}

/**
 * The slice of a corpus snapshot page this needs. Declared structurally rather
 * than imported from `payload-types` so the lib stays dependency-free.
 */
export interface SnapshotPageLike {
  url: string
  domain?: string | null
  position?: number | null
  domainRating?: number | null
}

/** Most common value, ties broken by the caller's `rank` (lower wins). */
function modalBy<T extends string>(values: T[], rank: (value: T) => number): T | null {
  const counts = new Map<T, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let best: T | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (best === null || count > bestCount || (count === bestCount && rank(value) < rank(best))) {
      best = value
      bestCount = count
    }
  }
  return best
}

/** Weakest first, so a tie between rubric guesses resolves downward. */
const CANDIDATE_RANK: Record<CandidateClass, number> = {
  unverified: 0,
  secondary: 1,
  official_docs: 2,
  primary: 3,
}

/**
 * The dropdown default for a candidate. Two branches, both defensible, neither
 * able to produce a class that clears a novel-claim floor by itself:
 *
 * - **Cited somewhere** — the verifier's own rubric class, taken modally across
 *   sightings. That guess is exactly the class the pipeline would have used had
 *   the unknown-domain cap not applied, so it is the most informative default
 *   available. `unknown` is ignored, `blocked` is read as `unverified` (a
 *   suggestion must not default to shutting a domain out), ties resolve to the
 *   weaker class, and nothing usable falls back to `secondary` — where the cap
 *   already lands the domain today.
 * - **SERP only** — `secondary` when the domain rating clears
 *   `SERP_SECONDARY_MIN_DR`, else `unverified`. A page that ranks is by
 *   definition a secondary treatment of the topic, and domain rating measures
 *   link popularity rather than accuracy, so it can never lift a suggestion to
 *   `official_docs` or `primary`. SERP position is shown to the reviewer but not
 *   used here: it is keyword-relative, while the rating is about the domain.
 */
export function suggestClass(sightings: CandidateSighting[]): CandidateClass {
  const rubric = sightings
    .filter((sighting) => sighting.kind === 'cited')
    .map((sighting) => sighting.sourceKind)
    .filter((kind): kind is SourceQualityClass => kind !== undefined && kind !== 'unknown')
    .map((kind): CandidateClass | null => {
      if (kind === 'blocked') return 'unverified'
      if (kind === 'first_party_dataset') return null
      return kind
    })
    .filter((kind): kind is CandidateClass => kind !== null)

  if (rubric.length > 0) return modalBy(rubric, (value) => CANDIDATE_RANK[value]) ?? 'secondary'
  if (sightings.some((sighting) => sighting.kind === 'cited')) return 'secondary'

  const rating = sightings.reduce<number | null>(
    (best, sighting) =>
      typeof sighting.domainRating === 'number' && (best === null || sighting.domainRating > best)
        ? sighting.domainRating
        : best,
    null,
  )
  return rating !== null && rating >= SERP_SECONDARY_MIN_DR ? 'secondary' : 'unverified'
}

/**
 * Every unrated domain this scoring run touched, one sighting per domain per
 * kind. A domain an active rule already matches is dropped here rather than
 * filtered later, so a rated domain stops accumulating sightings entirely.
 *
 * Failed and skipped SERP pages are kept: a page that ranks for the keyword is a
 * competitor whether or not the crawler could read it, and its domain is just as
 * worth rating.
 */
export function collectCandidateSightings(input: {
  claims: ClaimRecord[]
  pages: SnapshotPageLike[]
  rules: EvidenceSourceRule[]
  articleId: number
  keyword: string
  runId: number
  seenAt: string
}): CandidateSighting[] {
  const { claims, pages, rules, articleId, keyword, runId, seenAt } = input
  const unrated = (domain: string): boolean =>
    domain !== '' && matchEvidenceRule(domain, rules) === null

  const cited = new Map<string, { url: string; kinds: (SourceQualityClass | 'unknown')[] }>()
  for (const claim of claims) {
    for (const evidence of claim.evidence) {
      // 'evidence-sources' means a rule already covers it; the other two are
      // exactly the "nobody rated this" signal, capped or not.
      if (evidence.qualitySource === 'evidence-sources') continue
      const domain = normaliseDomain(evidence.domain)
      if (!unrated(domain)) continue
      const entry = cited.get(domain) ?? { url: evidence.url, kinds: [] }
      entry.kinds.push(evidence.sourceKind)
      cited.set(domain, entry)
    }
  }

  const serp = new Map<string, { url: string; position: number | null; rating: number | null }>()
  for (const page of pages) {
    const domain = normaliseDomain(page.domain ?? page.url)
    if (!unrated(domain)) continue
    const position = typeof page.position === 'number' ? page.position : null
    const rating = typeof page.domainRating === 'number' ? page.domainRating : null
    const entry = serp.get(domain)
    if (entry === undefined) {
      serp.set(domain, { url: page.url, position, rating })
      continue
    }
    // Best position wins: two pages on one host is one competitor, ranked once.
    if (position !== null && (entry.position === null || position < entry.position)) {
      entry.position = position
      entry.url = page.url
    }
    if (entry.rating === null && rating !== null) entry.rating = rating
  }

  const sightings: CandidateSighting[] = []
  for (const [domain, entry] of cited) {
    const kinds = entry.kinds.filter((kind) => kind !== 'unknown')
    sightings.push({
      domain,
      kind: 'cited',
      articleId,
      keyword,
      runId,
      seenAt,
      url: entry.url,
      citations: entry.kinds.length,
      sourceKind: kinds[0] ?? 'unknown',
    })
  }
  for (const [domain, entry] of serp) {
    sightings.push({
      domain,
      kind: 'serp',
      articleId,
      keyword,
      runId,
      seenAt,
      url: entry.url,
      ...(entry.position !== null ? { position: entry.position } : {}),
      domainRating: entry.rating,
    })
  }
  return sightings
}

/** A stored sighting is a JSON column, so nothing about its shape is trusted. */
function isSighting(value: unknown): value is CandidateSighting {
  if (value === null || typeof value !== 'object') return false
  const row = value as Partial<CandidateSighting>
  return (
    typeof row.domain === 'string' &&
    (row.kind === 'cited' || row.kind === 'serp') &&
    typeof row.articleId === 'number' &&
    typeof row.runId === 'number' &&
    typeof row.seenAt === 'string'
  )
}

/**
 * The stored sighting list after this run: newest first, one entry per
 * (kind, article, run), capped. The cap is why the counts are stored separately
 * — the list is for showing a reviewer where a domain turned up, not for
 * arithmetic.
 */
export function mergeSightings(
  existing: unknown,
  incoming: CandidateSighting[],
): CandidateSighting[] {
  const previous = Array.isArray(existing) ? existing.filter(isSighting) : []
  const merged: CandidateSighting[] = []
  const seen = new Set<string>()
  for (const sighting of [...incoming, ...previous]) {
    const key = `${sighting.kind}|${sighting.articleId}|${sighting.runId}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(sighting)
  }
  merged.sort((a, b) => b.seenAt.localeCompare(a.seenAt))
  return merged.slice(0, MAX_CANDIDATE_SIGHTINGS)
}
