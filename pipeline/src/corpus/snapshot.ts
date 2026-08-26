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
 * baseline would quietly inflate every novelty score computed against it.
 */

import { createHash } from 'node:crypto'

import type { Article, CorpusSnapshot, Template } from '../../../cms/src/payload-types'
import type { SerpResearch } from '../ahrefs'
import { config } from '../config'
import {
  type BaselineClaim,
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
 * never can — it recorded a failed crawl, not a baseline — and neither can one
 * whose timestamp is unreadable, since we cannot tell how stale it is.
 */
export function isSnapshotReusable(
  doc: { capturedAt: string; status: string },
  now: Date,
): boolean {
  if (doc.status === 'empty') return false
  const age = snapshotAgeDays(doc.capturedAt, now)
  return age !== null && age < SNAPSHOT_REUSE_DAYS
}

/** `empty` means no page yielded text at all, so there is no baseline to score against. */
export function snapshotStatus(
  okPages: number,
  failedPages: number,
): 'complete' | 'partial' | 'empty' {
  if (okPages <= 0) return 'empty'
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
    limit: 1,
    depth: 0,
  })
  const previous = existing[0]
  if (previous && isSnapshotReusable(previous, now)) {
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
    return parsePageClaims(json, {
      docId: `serp:${page.position}`,
      sourceKind: 'serp',
      idPrefix: `b${page.position}`,
      url: page.url,
    })
  })

  // Our own published articles on the same topic.
  const { docs: published } = await ctx.payload.find({
    collection: 'articles',
    where: { and: [{ status: { equals: 'published' } }, { id: { not_equals: article.id } }] },
    depth: 0,
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
    ...serpClaims.flat(),
    ...internalEntries.flatMap((entry) => entry.claims),
  ]
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
  }))

  const created = await ctx.payload.create({
    collection: 'corpus-snapshots',
    overrideAccess: true,
    data: {
      keyword: article.keyword,
      keywordKey: key,
      country,
      capturedAt: now.toISOString(),
      status: snapshotStatus(okPages.length, unusablePages),
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
      `${okPages.length}/${crawled.length} pages, ${internalEntries.length} internal, ` +
      `${claims.length} claims, ${facets.length} facets, ${gaps.length} gaps`,
  )
  return created
}
