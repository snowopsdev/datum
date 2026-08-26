/**
 * Information gain — how the draft's claims are split into LLM calls, and what
 * baseline context each call gets to compare them against.
 *
 * Every function here is pure and deterministic, because the batching decides
 * what the judge sees: two runs over the same draft must produce the same
 * batches, the same context, and therefore the same scores. Order comes from
 * the draft itself — claims arrive in document order and keep it — so nothing
 * depends on `Map` iteration luck, hash order, or the order a snapshot happened
 * to store its claims in.
 *
 * The caps are token budgets, not judgements: a batch of 12 claims against 50
 * baseline claims is roughly what one judge call can weigh carefully, and a
 * verifier call with web search stays smaller still.
 */

import {
  isVerifiableClaimType,
  nearDuplicateJaccard,
  tokenOverlap,
  type BaselineClaim,
  type DraftClaim,
  type InformationGainPolicy,
} from './lib'

/** The bucket for claims the extraction pass could not assign to a facet. */
export const OTHER_FACET_KEY = 'other'

/** Draft claims weighed in one judge call. */
export const DEFAULT_JUDGE_BATCH_SIZE = 12

/** Claims checked in one verifier call; smaller, because each one costs searches. */
export const DEFAULT_VERIFIER_BATCH_SIZE = 5

/** Same-facet SERP baseline claims sent with a judge batch. */
export const DEFAULT_SERP_CONTEXT_CAP = 50

/** Same-facet claims from our own published articles sent with a judge batch. */
export const DEFAULT_INTERNAL_CONTEXT_CAP = 20

/** Baseline claims sent with an `other` batch, which has no facet to filter on. */
export const DEFAULT_OTHER_CONTEXT_CAP = 40

/** Jaccard at or above which two claims in one draft are the same claim twice. */
export const NEAR_DUPLICATE_THRESHOLD = 0.8

/** What a claim's novelty is worth when it only restates an earlier one. */
export const RESTATEMENT_NOVELTY = 0.2

/**
 * Draft claims by facet, `null` collected under `'other'`.
 *
 * Insertion order is the order each facet **first appears in the draft**, and
 * claims keep their document order inside a group. Grouping this way rather
 * than by sorted facet id keeps a judge batch reading like a passage of the
 * article instead of a shuffled list, and it is just as deterministic: the
 * input order is fixed by `parseDraftClaims`.
 */
export function groupClaimsByFacet(claims: DraftClaim[]): Map<string, DraftClaim[]> {
  const groups = new Map<string, DraftClaim[]>()
  for (const claim of claims) {
    const key = claim.facetId ?? OTHER_FACET_KEY
    const group = groups.get(key)
    if (group === undefined) groups.set(key, [claim])
    else group.push(claim)
  }
  return groups
}

/** Fixed-size chunks, in order. A non-positive size would loop forever, so it is floored at 1. */
function chunk<T>(items: T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size))
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += step) {
    batches.push(items.slice(index, index + step))
  }
  return batches
}

export interface JudgeBatchOptions {
  maxPerBatch?: number
}

/**
 * The judge calls one draft costs, in order. Claims are grouped by facet first
 * so every claim in a batch is judged against the same slice of the baseline —
 * a batch spanning three facets would need all three facets' baseline claims in
 * context, which is exactly the token blow-up the caps exist to avoid.
 */
export function judgeBatches(claims: DraftClaim[], opts: JudgeBatchOptions = {}): DraftClaim[][] {
  const size = opts.maxPerBatch ?? DEFAULT_JUDGE_BATCH_SIZE
  const batches: DraftClaim[][] = []
  for (const group of groupClaimsByFacet(claims).values()) {
    batches.push(...chunk(group, size))
  }
  return batches
}

/** Where an unrecognised `docId` sorts: last, but still finite so ties subtract cleanly. */
const UNRANKED_PAGE = Number.MAX_SAFE_INTEGER

/**
 * The page position encoded in a SERP claim's `docId` (`serp:3`). Snapshots
 * already store claims in position order, so this is belt-and-braces: it
 * survives a snapshot whose claims were re-ordered, and an unrecognised `docId`
 * sorts last rather than jumping the queue.
 */
function pagePositionOf(claim: BaselineClaim): number {
  const match = /^serp:(\d+)$/.exec(claim.source.docId)
  return match === null ? UNRANKED_PAGE : Number(match[1])
}

/** A stable sort: ties keep the order the claims arrived in. */
function stableSort<T>(items: T[], rank: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, rank: rank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item)
}

export interface BaselineContextOptions {
  serpCap?: number
  internalCap?: number
  otherCap?: number
}

/** Whether a batch shares one real facet, or is the mixed/unassigned `other` case. */
function batchFacetId(batch: DraftClaim[]): string | null {
  const first = batch[0]?.facetId ?? null
  if (first === null) return null
  return batch.every((claim) => claim.facetId === first) ? first : null
}

/**
 * The baseline claims one judge batch is compared against.
 *
 * For a facet batch the answer is structural: the same facet's SERP claims
 * (highest-ranking page first, so a truncated list keeps the pages Google likes
 * most) followed by the same facet's claims from our own published articles.
 * Two caps rather than one, because the two corpora answer different questions
 * — "is this already on the SERP?" and "have we already published this?" — and
 * a facet the competitors cover heavily must not squeeze the internal claims
 * out of the prompt entirely.
 *
 * The `other` bucket has no facet to filter on, so relevance has to be
 * estimated: claims are ranked by how many meaningful tokens they share with
 * the batch's text, ties broken by the order they arrived in. That is a cheap
 * lexical proxy, not a semantic match — it is only picking which 40 claims the
 * judge reads, and the judge still decides what is a duplicate. Low-overlap
 * claims are kept rather than filtered out: an `other` batch with an empty
 * context would let the judge call everything novel by default.
 */
export function selectBaselineContext(
  batch: DraftClaim[],
  snapshotClaims: BaselineClaim[],
  opts: BaselineContextOptions = {},
): BaselineClaim[] {
  const facetId = batchFacetId(batch)

  if (facetId === null) {
    const batchText = batch.map((claim) => claim.text).join(' ')
    const ranked = stableSort(snapshotClaims, (claim) => -tokenOverlap(batchText, claim.text))
    return ranked.slice(0, Math.max(0, opts.otherCap ?? DEFAULT_OTHER_CONTEXT_CAP))
  }

  const sameFacet = snapshotClaims.filter((claim) => claim.facetId === facetId)
  const serp = stableSort(
    sameFacet.filter((claim) => claim.source.kind === 'serp'),
    pagePositionOf,
  ).slice(0, Math.max(0, opts.serpCap ?? DEFAULT_SERP_CONTEXT_CAP))
  const internal = sameFacet
    .filter((claim) => claim.source.kind === 'internal')
    .slice(0, Math.max(0, opts.internalCap ?? DEFAULT_INTERNAL_CONTEXT_CAP))

  return [...serp, ...internal]
}

/** A draft claim with the novelty the judge pass gave it. */
export interface VerificationCandidate {
  claim: DraftClaim
  /** 0–1, uncalibrated: derived from the judge's duplicate probability. */
  novelty: number
}

/**
 * The claims worth spending a web-search verifier call on: the materially novel
 * ones whose kind can be checked against outside evidence at all. Opinions and
 * recommendations are left out because no citation settles them.
 *
 * `first_party_measurement` is deliberately *in*, even though the policy blocks
 * every one of them: the reviewer looking at a blocked draft needs to see what
 * the web actually says about the number the model invented, not an empty
 * evidence list.
 */
export function pickForVerification(
  claims: VerificationCandidate[],
  policy: InformationGainPolicy,
): DraftClaim[] {
  return claims
    .filter(
      (candidate) =>
        isVerifiableClaimType(candidate.claim.type) &&
        candidate.novelty >= policy.materialNoveltyThreshold,
    )
    .map((candidate) => candidate.claim)
}

/** The verifier calls those claims cost, in order. */
export function verifierBatches(
  claims: DraftClaim[],
  size = DEFAULT_VERIFIER_BATCH_SIZE,
): DraftClaim[][] {
  return chunk(claims, size)
}

/**
 * How much a claim adds *to this draft*, before any comparison with the outside
 * world: 1 for something the draft has not said yet, `RESTATEMENT_NOVELTY` when
 * the extraction pass flagged it as restating an earlier claim, and 0 when it
 * is lexically a near-duplicate of one.
 *
 * The two penalties are not additive and the harsher one wins: a claim can be
 * both flagged and near-identical, and saying the same sentence twice earns
 * nothing regardless of whether the model admitted it. `earlierClaims` must be
 * the claims *before* this one in document order — the first statement of a
 * fact keeps its full value, the repeat is what gets discounted.
 */
export function intraDocumentNovelty(claim: DraftClaim, earlierClaims: DraftClaim[]): number {
  const nearDuplicate = earlierClaims.some(
    (earlier) => nearDuplicateJaccard(claim.text, earlier.text) >= NEAR_DUPLICATE_THRESHOLD,
  )
  if (nearDuplicate) return 0

  const restates =
    claim.restatesClaimId !== null &&
    earlierClaims.some((earlier) => earlier.id === claim.restatesClaimId)
  return restates ? RESTATEMENT_NOVELTY : 1
}
