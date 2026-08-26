/**
 * Builds — or reuses — the corpus snapshot a keyword is scored against: the
 * top-ranking pages' text, the claims extracted from them, our own published
 * articles on the same topic, and the consensus facets and gaps that fall out
 * of clustering all of it.
 *
 * A snapshot is expensive (one crawl and one LLM call per baseline document),
 * so it is keyed by (keyword, country) and shared by every article on that
 * keyword until it ages out. Reuse is the normal path; building is the
 * exception. Everything above `getOrBuildSnapshot` is pure and unit-tested —
 * the builder itself needs Payload and the network, so it is not.
 *
 * Only the fetch layer tolerates failure: a page that will not load is recorded
 * with its reason and the snapshot goes `partial`. A claim-extraction reply
 * that does not parse fails the whole snapshot, because a silently thinner
 * baseline would quietly inflate every novelty score computed against it — the
 * same reason a claim whose excerpt is not in the page is counted rather than
 * dropped (`countUnverifiedExcerpts`). A build that parses everything and still
 * ends up with no claims is recorded as `empty` for the same reason: a baseline
 * of nothing is not a baseline, and reusing it for a fortnight would let every
 * draft on that keyword score as wholly novel.
 */

import { createHash } from 'node:crypto'

import type { Article, CorpusSnapshot, Template } from '../../../cms/src/payload-types'
import type { SerpResearch } from '../ahrefs'
import { config } from '../config'
import {
  type BaselineClaim,
  excerptFoundIn,
  type Facet,
  hostnameOf,
  type InformationGap,
  parseFacetClustering,
  parsePageClaims,
  type QueryClusterEntry,
  selectInternalCorpus,
} from '../informationGain/lib'
import { completeJSONLogged } from '../llm'
import type { StageContext } from '../stages'

import { mapWithConcurrency } from './concurrency'
import { fetchPage, type FetchedPage } from './fetchPage'
import {
  type InternalCorpusDoc,
  type InternalCorpusEntry,
  internalCorpusEntry,
} from './internalCorpus'
import {
  FACET_CLUSTERING_SYSTEM,
  facetClusteringUser,
  PAGE_CLAIM_EXTRACTION_SYSTEM,
  pageClaimUser,
} from './prompts'

/** How long a captured corpus stays good enough to score a new draft against. */
export const SNAPSHOT_REUSE_DAYS = 14

/** Ranking pages crawled per snapshot. */
export const SERP_PAGE_CAP = 10

/** Our own published articles compared against, most topically related first. */
export const INTERNAL_CORPUS_CAP = 5

/** Claims sent to the clustering call; beyond this the prompt costs more than it learns. */
export const FACET_CLAIM_CAP = 400

/** Pages fetched, and pages sent for claim extraction, at a time. */
const CONCURRENCY = 3

const DAY_MS = 24 * 60 * 60 * 1000

/** Trimmed, lower-cased, whitespace-collapsed: the reuse key two spellings share. */
export function keywordKey(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** A snapshot's age in days, or null when `capturedAt` is not a date we can read. */
export function snapshotAgeDays(capturedAt: string, now: Date): number | null {
  const at = Date.parse(capturedAt)
  return Number.isNaN(at) ? null : (now.getTime() - at) / DAY_MS
}

/**
 * Whether an existing snapshot can stand in for a fresh crawl. An `empty` one
 * never can — it recorded a failed crawl or a claimless one, not a baseline —
 * and neither can one whose timestamp is unreadable, since we cannot tell how
 * stale it is.
 */
export function isSnapshotReusable(
  doc: { capturedAt: string; status: string },
  now: Date,
): boolean {
  if (doc.status === 'empty') return false
  const age = snapshotAgeDays(doc.capturedAt, now)
  return age !== null && age < SNAPSHOT_REUSE_DAYS
}

/** How many recent snapshots to consider before deciding to rebuild. */
export const REUSE_LOOKBACK = 3

/**
 * The newest reusable snapshot from a newest-first list, or null.
 *
 * Looking past the first row matters: a total crawl failure writes an `empty`
 * row, and testing only the newest one would let that failure shadow a perfectly
 * good snapshot from two days ago and pay for the whole crawl again.
 */
export function pickReusable<T extends { capturedAt: string; status: string }>(
  docs: T[],
  now: Date,
): T | null {
  return docs.find((doc) => isSnapshotReusable(doc, now)) ?? null
}

/**
 * `empty` means there is no baseline to score against, for either of two
 * reasons: no page yielded text at all, or pages were read but extraction
 * produced no claims. Both are unusable — an `empty` snapshot is never reused —
 * and the stored row still tells them apart: a claimless build has
 * `baselineDocCount > 0` with `failedPageCount` counting only the pages that
 * genuinely failed, where a failed crawl has `baselineDocCount` at zero and
 * every page in `failedPageCount`. The builder also logs which one happened.
 */
export function snapshotStatus(
  okPages: number,
  failedPages: number,
  claimCount: number,
): 'complete' | 'partial' | 'empty' {
  if (okPages <= 0 || claimCount <= 0) return 'empty'
  return failedPages > 0 ? 'partial' : 'complete'
}

export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/**
 * A fingerprint of the crawled corpus: which URLs, and what each one said.
 * Sorted, so re-crawling the same pages in a different SERP order produces the
 * same hash and a rebuild can be recognised as "nothing actually changed".
 */
export function snapshotHash(pages: { url: string; textHash: string }[]): string {
  return textHash(
    pages
      .map((page) => `${page.url}|${page.textHash}`)
      .sort()
      .join('\n'),
  )
}

/** One row of the snapshot's `pages` array, built from a SERP result plus its fetch. */
type PageRow = NonNullable<CorpusSnapshot['pages']>[number]

/**
 * How many of a document's claims quote something the document does not say.
 *
 * The claims are kept either way, deliberately: a hallucinated excerpt makes a
 * baseline claim untrustworthy, but dropping it shrinks the baseline, and a
 * smaller baseline makes every draft scored against it look *more* novel. Over-
 * dropping would cause false passes, which is worse than a soft claim. The
 * count is recorded per document so PR3 can decide whether to weight or drop.
 */
export function countUnverifiedExcerpts(claims: BaselineClaim[], text: string): number {
  return claims.filter((claim) => !excerptFoundIn(claim.excerpt, text)).length
}

/**
 * The corpus snapshot for this article's keyword: an existing one when it is
 * fresh enough, otherwise a newly crawled, extracted, and clustered one.
 *
 * `queryCluster` is passed in rather than derived here because the research
 * stage builds it from the same SERP response and stores it on the article too;
 * deriving it twice is how the two copies drift.
 */
export async function getOrBuildSnapshot(
  ctx: StageContext,
  article: Article,
  template: Template,
  serp: SerpResearch,
  queryCluster: QueryClusterEntry[],
): Promise<CorpusSnapshot> {
  const now = new Date()
  const key = keywordKey(article.keyword)
  const country = config.ahrefsCountry

  const { docs: existing } = await ctx.payload.find({
    collection: 'corpus-snapshots',
    where: { and: [{ keywordKey: { equals: key } }, { country: { equals: country } }] },
    sort: '-capturedAt',
    limit: REUSE_LOOKBACK,
    depth: 0,
  })
  const previous = pickReusable(existing, now)
  if (previous) {
    const ageDays = Math.floor(snapshotAgeDays(previous.capturedAt, now) ?? 0)
    console.log(`[research] reusing corpus snapshot ${previous.id} (${ageDays}d old)`)
    return previous
  }

  // Crawl the ranking pages.
  const serpPages = serp.pages.slice(0, SERP_PAGE_CAP)
  const fetched = await mapWithConcurrency(serpPages, CONCURRENCY, (page) => fetchPage(page.url))
  const crawled = serpPages.map((page, index) => ({ page, fetched: fetched[index] as FetchedPage }))
  const okPages = crawled.filter((entry) => entry.fetched.status === 'ok')
  // A skipped page (a PDF, say) is as unusable as a failed one for the baseline.
  const unusablePages = crawled.length - okPages.length

  const serpClaims = await mapWithConcurrency(okPages, CONCURRENCY, async ({ page, fetched }) => {
    const { json } = await completeJSONLogged(ctx, 'claimExtraction', article.id, {
      system: PAGE_CLAIM_EXTRACTION_SYSTEM,
      user: pageClaimUser(article.keyword, page, fetched.text),
      fixtureKey: 'page',
    })
    const claims = parsePageClaims(json, {
      docId: `serp:${page.position}`,
      sourceKind: 'serp',
      idPrefix: `b${page.position}`,
      url: page.url,
    })
    const unverified = countUnverifiedExcerpts(claims, fetched.text)
    if (unverified > 0) {
      console.warn(
        `[research] page ${page.position}: ${unverified}/${claims.length} claim excerpts ` +
          `not found in the fetched text`,
      )
    }
    return { position: page.position, claims, unverified }
  })

  // Our own published articles on the same topic.
  const { docs: published } = await ctx.payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { id: { not_equals: article.id } }] },
    depth: 0,
    // Most-recently-touched first, so once the site passes 200 published
    // articles the window we score against is at least the current content
    // rather than an arbitrary slice.
    sort: '-updatedAt',
    limit: 200,
    select: { keyword: true, updatedAt: true, title: true, body: true, faqItems: true },
  })
  const internalDocs = selectInternalCorpus(
    article.keyword,
    published as InternalCorpusDoc[],
    INTERNAL_CORPUS_CAP,
  )
  // Sequential, not concurrent: each entry may hit the snapshot cache, and a
  // cache hit costs one query instead of a whole extraction call.
  const internalEntries: InternalCorpusEntry[] = []
  for (const doc of internalDocs) {
    internalEntries.push(await internalCorpusEntry(ctx, article.id, article.keyword, doc))
  }

  const claims: BaselineClaim[] = [
    ...serpClaims.flatMap((entry) => entry.claims),
    ...internalEntries.flatMap((entry) => entry.claims),
  ]
  const unverifiedByPosition = new Map(
    serpClaims.map((entry) => [entry.position, entry.unverified]),
  )
  const baselineDocCount = okPages.length + internalEntries.length

  // Cluster the pooled claims into consensus facets and the gaps they leave.
  const hints = (template.requiredSections ?? []).map((section) => section.heading)
  let facets: Facet[] = []
  let gaps: InformationGap[] = []
  if (claims.length > 0) {
    const { json } = await completeJSONLogged(ctx, 'claimExtraction', article.id, {
      system: FACET_CLUSTERING_SYSTEM,
      user: facetClusteringUser(
        article.keyword,
        queryCluster,
        hints,
        claims.slice(0, FACET_CLAIM_CAP).map((claim) => ({
          id: claim.id,
          text: claim.text,
          docId: claim.source.docId,
        })),
      ),
      fixtureKey: 'facets',
    })
    const clustered = parseFacetClustering(json, claims, hints, baselineDocCount)
    facets = clustered.facets
    gaps = clustered.gaps
    for (const claim of claims) claim.facetId = clustered.claimFacet.get(claim.id) ?? null
  }

  const claimCountFor = (docId: string): number =>
    claims.filter((claim) => claim.source.docId === docId).length

  const pageRows: PageRow[] = crawled.map(({ page, fetched }) => ({
    position: page.position,
    url: page.url,
    title: fetched.title ?? page.title,
    domain: hostnameOf(page.url),
    domainRating: page.domainRating,
    fetchStatus: fetched.status,
    failureReason: fetched.reason,
    chars: fetched.chars,
    textHash: fetched.status === 'ok' ? textHash(fetched.text) : null,
    text: fetched.status === 'ok' ? fetched.text : null,
    claimCount: claimCountFor(`serp:${page.position}`),
    unverifiedExcerptCount: unverifiedByPosition.get(page.position) ?? null,
  }))

  if (okPages.length > 0 && claims.length === 0) {
    console.warn(
      `[research] corpus snapshot for "${article.keyword}": ${okPages.length} page(s) read but ` +
        'claim extraction produced no claims; storing it as empty so it is not reused',
    )
  }

  const created = await ctx.payload.create({
    collection: 'corpus-snapshots',
    overrideAccess: true,
    data: {
      keyword: article.keyword,
      keywordKey: key,
      country,
      capturedAt: now.toISOString(),
      status: snapshotStatus(okPages.length, unusablePages, claims.length),
      pipelineRunId: ctx.runId,
      snapshotHash: snapshotHash(
        pageRows.flatMap((row) => (row.textHash ? [{ url: row.url, textHash: row.textHash }] : [])),
      ),
      models: { claimExtraction: ctx.models.claimExtraction },
      queryCluster,
      pages: pageRows,
      internalCorpus: internalEntries.map((entry) => ({
        article: entry.doc.id,
        articleUpdatedAt: entry.doc.updatedAt,
        claimCount: entry.claims.length,
      })),
      baselineClaims: claims,
      facets,
      gaps,
      baselineDocCount,
      failedPageCount: unusablePages,
    },
  })
  console.log(
    `[research] built corpus snapshot ${created.id} for "${article.keyword}": ` +
      `${okPages.length}/${crawled.length} pages, ${internalEntries.length} internal ` +
      `(${internalEntries.filter((entry) => entry.cached).length} from cache), ` +
      `${claims.length} claims, ${facets.length} facets, ${gaps.length} gaps`,
  )
  return created
}
