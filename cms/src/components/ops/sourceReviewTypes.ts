/**
 * The server→client boundary for the source review queue.
 *
 * A candidate's `sightings` is a JSON column written by the pipeline, so nothing
 * about its shape is guaranteed by the time it reaches here. Everything below
 * degrades — a malformed sighting is dropped, a missing article becomes a plain
 * label — rather than throwing or leaking `undefined` into the page.
 */

import type { ArticleStatus } from './articleStatus'
import type { EvidenceSourceCandidate } from '../../payload-types'
import {
  matchEvidenceRule,
  normaliseDomain,
  type CandidateClass,
  type EvidenceSourceRule,
  type SourceQualityClass,
} from '../../lib/informationGain'

/** Ranking badges shown per card before the list is summarised as "+N more". */
export const MAX_SERP_BADGES = 3

export type CandidateStatus = EvidenceSourceCandidate['status']

export type SerpBadge = { keyword: string; position: number }

export type CandidateCitation = {
  articleId: number
  label: string
  href: string
  status: ArticleStatus | null
  citations: number
}

export type CoveringRule = {
  domain: string
  qualityClass: SourceQualityClass
  href: string | null
}

export type CandidateDTO = {
  id: number
  domain: string
  status: CandidateStatus
  suggestedClass: CandidateClass
  citationCount: number
  serpCount: number
  domainRating: number | null
  lastSeenLabel: string
  serpBadges: SerpBadge[]
  hiddenSerpBadges: number
  citedBy: CandidateCitation[]
  /** Set when an active rule already covers this domain, however it got there. */
  coveredBy: CoveringRule | null
  resolvedBy: string | null
}

export type ArticleLookup = Map<number, { title?: string | null; keyword?: string | null; status?: string | null }>

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object') : []

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)

/** `2026-08-26T…` → `26 Aug 2026`; an unparseable stamp shows as a dash. */
export function formatSeenAt(value: unknown): string {
  const raw = str(value)
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * One badge per keyword at its best position, strongest first. A domain ranking
 * twice for one keyword is still one fact about that keyword, and the same
 * domain across many keywords is the interesting case the cap has to preserve.
 */
function toSerpBadges(sightings: Record<string, unknown>[]): SerpBadge[] {
  const best = new Map<string, number>()
  for (const sighting of sightings) {
    if (sighting.kind !== 'serp') continue
    const position = num(sighting.position)
    const keyword = str(sighting.keyword)
    if (position === null || !keyword) continue
    const current = best.get(keyword)
    if (current === undefined || position < current) best.set(keyword, position)
  }
  return [...best.entries()]
    .map(([keyword, position]) => ({ keyword, position }))
    .sort((a, b) => a.position - b.position || a.keyword.localeCompare(b.keyword))
}

/** One entry per article that cited this domain, most citations first. */
function toCitedBy(
  sightings: Record<string, unknown>[],
  articles: ArticleLookup,
): CandidateCitation[] {
  const byArticle = new Map<number, number>()
  const keywords = new Map<number, string>()
  for (const sighting of sightings) {
    if (sighting.kind !== 'cited') continue
    const articleId = num(sighting.articleId)
    if (articleId === null) continue
    byArticle.set(articleId, (byArticle.get(articleId) ?? 0) + (num(sighting.citations) ?? 1))
    const keyword = str(sighting.keyword)
    if (keyword && !keywords.has(articleId)) keywords.set(articleId, keyword)
  }
  return [...byArticle.entries()]
    .map(([articleId, citations]) => {
      const article = articles.get(articleId)
      // Title, then the keyword the sighting carried, then the bare id: a
      // deleted article should still be a readable row, not a blank one.
      const label =
        (article?.title ?? '').trim() ||
        (article?.keyword ?? '').trim() ||
        keywords.get(articleId) ||
        `Article ${articleId}`
      return {
        articleId,
        label,
        href: `/admin/ops/articles/${articleId}`,
        status: (article?.status as ArticleStatus | undefined) ?? null,
        citations,
      }
    })
    .sort((a, b) => b.citations - a.citations || a.label.localeCompare(b.label))
}

/**
 * One card's worth of data.
 *
 * `coveredBy` is computed against the live rules rather than read off `status`,
 * because a rule added or deactivated by hand never touches a candidate row.
 * That check is what keeps a hand-rated domain out of the queue and puts a
 * de-rated one back into it, with no write on either side.
 */
export function toCandidateDTO(
  doc: EvidenceSourceCandidate,
  rules: { id: number; domain: string; qualityClass: string; active?: boolean | null }[],
  articles: ArticleLookup = new Map(),
): CandidateDTO {
  const sightings = asRecordArray(doc.sightings)
  const badges = toSerpBadges(sightings)
  const asRules: EvidenceSourceRule[] = rules.map((rule) => ({
    domain: rule.domain,
    qualityClass: rule.qualityClass as SourceQualityClass,
    active: rule.active ?? false,
  }))
  const matched = matchEvidenceRule(normaliseDomain(doc.domain), asRules)
  const matchedDoc = matched
    ? rules.find((rule) => normaliseDomain(rule.domain) === normaliseDomain(matched.domain))
    : undefined

  return {
    id: doc.id,
    domain: doc.domain,
    status: doc.status,
    suggestedClass: doc.suggestedClass as CandidateClass,
    citationCount: num(doc.citationCount) ?? 0,
    serpCount: num(doc.serpCount) ?? 0,
    domainRating: num(doc.domainRating),
    lastSeenLabel: formatSeenAt(doc.lastSeenAt),
    serpBadges: badges.slice(0, MAX_SERP_BADGES),
    hiddenSerpBadges: Math.max(0, badges.length - MAX_SERP_BADGES),
    citedBy: toCitedBy(sightings, articles),
    coveredBy: matched
      ? {
          domain: matched.domain,
          qualityClass: matched.qualityClass,
          href: matchedDoc ? `/admin/collections/evidence-sources/${matchedDoc.id}` : null,
        }
      : null,
    resolvedBy: doc.resolvedBy ?? null,
  }
}

/**
 * Which tab a card belongs under.
 *
 * A pending candidate an active rule already covers is shown as settled, not as
 * work: somebody rated it, just not from here.
 */
export function queueBucket(dto: CandidateDTO): 'review' | 'rated' | 'dismissed' {
  if (dto.status === 'dismissed') return 'dismissed'
  if (dto.status === 'approved' || dto.coveredBy !== null) return 'rated'
  return 'review'
}
