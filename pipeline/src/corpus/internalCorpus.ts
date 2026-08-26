/**
 * The internal half of a corpus snapshot: claims from our own published
 * articles, so the scorer can tell "new to the web" from "new to this site".
 *
 * Re-extracting claims from an article that has not changed is pure waste, so
 * this module reads them back out of any earlier snapshot that already listed
 * the article with the same `updatedAt`. The cache lookup filters on an array
 * subfield relationship (`internalCorpus.article`), which the postgres adapter
 * may refuse; a refusal is not an error here — it just means the extraction
 * runs again, so it degrades to a cache miss rather than failing the run.
 */

import type { Article, CorpusSnapshot } from '../../../cms/src/payload-types'
import { type BaselineClaim, excerptFoundIn, parsePageClaims } from '../informationGain/lib'
import { completeJSONLogged } from '../llm'
import { lexicalToPlainText, type RichText } from '../richtext'
import type { StageContext } from '../stages'

import { internalClaimUser, PAGE_CLAIM_EXTRACTION_SYSTEM } from './prompts'

/** How many recent snapshots to search for a cached copy of one article's claims. */
const CACHE_LOOKBACK = 3

/** The subset of an article the internal corpus needs; `find` selects exactly these. */
export interface InternalCorpusDoc {
  id: number
  keyword: string
  updatedAt: string
  title?: string | null
  body?: Article['body']
  faqItems?: Article['faqItems']
}

export interface InternalCorpusEntry {
  doc: InternalCorpusDoc
  claims: BaselineClaim[]
  /** Whether the claims came from an earlier snapshot instead of a fresh LLM call. */
  cached: boolean
}

const idOf = (value: number | { id: number }): number =>
  typeof value === 'object' ? value.id : value

/** Two timestamps for the same instant, however each side chose to format it. */
function sameInstant(a: string, b: string): boolean {
  const first = Date.parse(a)
  const second = Date.parse(b)
  return !Number.isNaN(first) && first === second
}

/** `baselineClaims` is a JSON column, so it is whatever was written into it. */
function storedClaims(value: CorpusSnapshot['baselineClaims']): BaselineClaim[] {
  return Array.isArray(value) ? (value as BaselineClaim[]) : []
}

/**
 * The article's claims as this snapshot should hold them: ids renumbered under
 * this article's prefix so they cannot collide with the SERP claims, and
 * `facetId` cleared because the facets are re-clustered for every snapshot.
 */
function adopt(claims: BaselineClaim[], articleId: number): BaselineClaim[] {
  return claims.map((claim, index) => ({
    ...claim,
    id: `i${articleId}-${index + 1}`,
    facetId: null,
    source: { kind: 'internal' as const, docId: `internal:${articleId}`, articleId },
  }))
}

/** Claims for `doc` from an earlier snapshot of the same article revision, or null. */
async function cachedClaims(
  ctx: StageContext,
  doc: InternalCorpusDoc,
): Promise<BaselineClaim[] | null> {
  let snapshots: CorpusSnapshot[]
  try {
    const { docs } = await ctx.payload.find({
      collection: 'corpus-snapshots',
      where: { 'internalCorpus.article': { equals: doc.id } },
      sort: '-capturedAt',
      limit: CACHE_LOOKBACK,
      depth: 0,
    })
    snapshots = docs
  } catch {
    // The adapter would not filter on the array subfield; re-extract instead.
    // Worth a line: a silent refusal turns every internal doc into a paid call.
    console.warn(
      `[research] internal corpus claim cache unavailable (adapter rejected the ` +
        `internalCorpus.article filter); re-extracting article ${doc.id}`,
    )
    return null
  }

  for (const snapshot of snapshots) {
    const entry = snapshot.internalCorpus?.find((row) => idOf(row.article) === doc.id)
    if (!entry || !sameInstant(entry.articleUpdatedAt, doc.updatedAt)) continue
    const claims = storedClaims(snapshot.baselineClaims).filter(
      (claim) => claim.source?.articleId === doc.id,
    )
    if (claims.length > 0) return adopt(claims, doc.id)
  }
  return null
}

/** Body plus FAQ as one block of plain text — the same text the QA stage judges. */
function articleText(doc: InternalCorpusDoc): string {
  const body = doc.body ? lexicalToPlainText(doc.body as RichText) : ''
  const faq = (doc.faqItems ?? [])
    .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
    .join('\n\n')
  return [body, faq].filter((part) => part.length > 0).join('\n\n')
}

/**
 * One published article's claims, cached when the article has not changed since
 * a previous snapshot listed it. `articleId` is the article being researched —
 * the cost row belongs to it, not to the older article being read.
 */
export async function internalCorpusEntry(
  ctx: StageContext,
  articleId: number,
  keyword: string,
  doc: InternalCorpusDoc,
): Promise<InternalCorpusEntry> {
  const cached = await cachedClaims(ctx, doc)
  if (cached) return { doc, claims: cached, cached: true }

  const text = articleText(doc)
  const { json } = await completeJSONLogged(ctx, 'claimExtraction', articleId, {
    system: PAGE_CLAIM_EXTRACTION_SYSTEM,
    user: internalClaimUser(
      keyword,
      { id: doc.id, title: doc.title ?? null, keyword: doc.keyword },
      text,
    ),
    fixtureKey: 'page',
  })
  const claims = parsePageClaims(json, {
    docId: `internal:${doc.id}`,
    sourceKind: 'internal',
    idPrefix: `i${doc.id}`,
    articleId: doc.id,
  })
  // Same accounting as the SERP pages: excerpts are counted, never dropped.
  // Only possible on the extraction path — a cache hit has no text at hand.
  const unverified = claims.filter((claim) => !excerptFoundIn(claim.excerpt, text)).length
  if (unverified > 0) {
    console.warn(
      `[research] internal article ${doc.id}: ${unverified}/${claims.length} claim excerpts ` +
        `not found in the article text`,
    )
  }
  return { doc, claims, cached: false }
}
