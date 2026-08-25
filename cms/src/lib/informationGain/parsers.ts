/**
 * Information gain — parsers for the LLM replies the pipeline collects.
 *
 * Five prompts feed the scorer (page claims, facet clustering, draft claims,
 * the judge, the verifier) and every one of them returns free-form JSON. These
 * parsers are the only place that JSON is trusted: they throw when the
 * top-level shape is wrong, coerce and clamp every scalar, and drop entries
 * that fail the "the model must quote its evidence" bar — the same contract
 * `pipeline/src/qa/verdicts.ts` uses for the QA verdicts. Nothing here decides
 * anything; the numbers they emit are uncalibrated LLM estimates that
 * `scoring.ts` turns into a decision. Like the rest of
 * `cms/src/lib/informationGain/`, this file stays free of `next`, `react`,
 * `payload`, `@/` aliases, `process.env`, and `node:*` imports.
 */

import { clamp01, clampImportance } from './scoring'
import { facetWeights } from './coverage'
import { hostnameOf } from './sourceQuality'
import { excerptFoundIn } from './text'
import {
  CLAIM_TYPES,
  SOURCE_QUALITY_CLASSES,
  type BaselineClaim,
  type BaselineClaimSource,
  type ClaimType,
  type DraftClaim,
  type Facet,
  type InformationGap,
  type SourceQualityClass,
} from './types'

/** Claims kept per baseline page; a long page costs judge tokens, not insight. */
export const DEFAULT_MAX_PAGE_CLAIMS = 40

/** Claims kept per draft. */
export const DEFAULT_MAX_DRAFT_CLAIMS = 60

export const MAX_FACETS = 12

export const MAX_GAPS = 8

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

/** A trimmed non-empty string, or null — the shape every "must quote" check wants. */
const asTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const asClaimType = (value: unknown): ClaimType | null =>
  typeof value === 'string' && (CLAIM_TYPES as readonly string[]).includes(value)
    ? (value as ClaimType)
    : null

/** A 0–1 signal: anything the model did not send as a number is worth nothing. */
const asProbability = (value: unknown): number => (typeof value === 'number' ? clamp01(value) : 0)

const knownId = (value: unknown, known: ReadonlySet<string>): string | null =>
  typeof value === 'string' && known.has(value) ? value : null

function arrayField(json: unknown, key: string, message: string): unknown[] {
  const value = asRecord(json)?.[key]
  if (!Array.isArray(value)) throw new Error(message)
  return value
}

/** Indexes a reply's claim entries by `claimId`; the first entry for an id wins. */
function claimsById(entries: unknown[]): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>()
  for (const entry of entries) {
    const record = asRecord(entry)
    if (record === null) continue
    const claimId = record.claimId
    if (typeof claimId !== 'string' || byId.has(claimId)) continue
    byId.set(claimId, record)
  }
  return byId
}

interface ClaimCore {
  text: string
  type: ClaimType
  excerpt: string
  entities: string[]
  values: string[]
}

/**
 * The fields every extracted claim shares. Null — meaning "drop this entry" —
 * whenever the model failed to state the claim, quote it, or label it with a
 * type we recognise: an unquoted claim cannot be checked against its source.
 */
function parseClaimCore(entry: unknown): ClaimCore | null {
  const record = asRecord(entry)
  if (record === null) return null
  const text = asTrimmed(record.text)
  const excerpt = asTrimmed(record.excerpt)
  const type = asClaimType(record.type)
  if (text === null || excerpt === null || type === null) return null
  return {
    text,
    type,
    excerpt,
    entities: asStringArray(record.entities),
    values: asStringArray(record.values),
  }
}

export interface PageClaimsParseOptions {
  docId: string
  sourceKind: 'serp' | 'internal'
  idPrefix: string
  url?: string
  articleId?: number
  maxClaims?: number
}

/**
 * Claims extracted from one baseline page — a SERP competitor or one of our own
 * articles. Ids are prefixed per document so claims from the whole corpus can be
 * pooled without colliding, and numbered over the surviving entries.
 */
export function parsePageClaims(json: unknown, opts: PageClaimsParseOptions): BaselineClaim[] {
  const entries = arrayField(json, 'claims', 'page claims reply must have a "claims" array')
  const maxClaims = opts.maxClaims ?? DEFAULT_MAX_PAGE_CLAIMS

  const source: BaselineClaimSource = { kind: opts.sourceKind, docId: opts.docId }
  if (opts.url !== undefined) source.url = opts.url
  if (opts.articleId !== undefined) source.articleId = opts.articleId

  const claims: BaselineClaim[] = []
  for (const entry of entries) {
    if (claims.length >= maxClaims) break
    const core = parseClaimCore(entry)
    if (core === null) continue
    claims.push({
      id: `${opts.idPrefix}-${claims.length + 1}`,
      ...core,
      // Baseline claims are assigned to facets by the clustering pass, not here.
      facetId: null,
      source: { ...source },
    })
  }
  return claims
}

type FacetDraft = Omit<Facet, 'weight'>

const facetIdOf = (value: unknown, index: number): string => {
  const explicit = asTrimmed(value)
  if (explicit !== null) return explicit
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return `f${index + 1}`
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * The consensus facets the baseline corpus agrees on, plus the gaps it leaves.
 * A claim belongs to exactly one facet — the first that claims it — so
 * `docCount` counts each source document once and coverage cannot be inflated
 * by listing the same claim under every facet.
 */
export function parseFacetClustering(
  json: unknown,
  baselineClaims: BaselineClaim[],
  hints: string[],
  totalDocs: number,
): { facets: Facet[]; gaps: InformationGap[]; claimFacet: Map<string, string> } {
  const record = asRecord(json)
  const rawFacets = record?.facets
  if (!Array.isArray(rawFacets)) {
    throw new Error('facet clustering reply must have a "facets" array')
  }

  const docIdByClaim = new Map(baselineClaims.map((claim) => [claim.id, claim.source.docId]))
  const normalisedHints = new Set(
    hints.map((hint) => hint.trim().toLowerCase()).filter((hint) => hint !== ''),
  )

  const claimFacet = new Map<string, string>()
  const drafts: FacetDraft[] = rawFacets.slice(0, MAX_FACETS).map((entry, index) => {
    const facet = asRecord(entry) ?? {}
    const id = facetIdOf(facet.id, index)

    const claimIds: string[] = []
    const docIds = new Set<string>()
    for (const claimId of Array.isArray(facet.claimIds) ? facet.claimIds : []) {
      if (typeof claimId !== 'string') continue
      const docId = docIdByClaim.get(claimId)
      // Unknown claim, or one an earlier facet already took.
      if (docId === undefined || claimFacet.has(claimId)) continue
      claimFacet.set(claimId, id)
      claimIds.push(claimId)
      docIds.add(docId)
    }

    const hint = facet.matchesHint
    return {
      id,
      label: asText(facet.label),
      description: asText(facet.description),
      docCount: docIds.size,
      mustHave: typeof hint === 'string' && normalisedHints.has(hint.trim().toLowerCase()),
      claimIds,
    }
  })

  const weights = facetWeights(drafts, totalDocs)
  const facets: Facet[] = drafts.map((draft, index) => ({ ...draft, weight: weights[index] ?? 0 }))

  const facetIds = new Set(facets.map((facet) => facet.id))
  const gaps: InformationGap[] = []
  for (const entry of Array.isArray(record?.gaps) ? (record.gaps as unknown[]) : []) {
    if (gaps.length >= MAX_GAPS) break
    const gap = asRecord(entry)
    if (gap === null) continue
    // A gap nobody named or explained is not actionable.
    if (typeof gap.label !== 'string' || typeof gap.description !== 'string') continue
    gaps.push({
      facetId: knownId(gap.facetId, facetIds),
      label: gap.label,
      description: gap.description,
      evidenceHint: asText(gap.evidenceHint),
    })
  }

  return { facets, gaps, claimFacet }
}

/**
 * Claims extracted from the draft under review. `restatesClaimIndex` points at
 * the model's own reply array — the *pre-filter* index — so it is resolved
 * through a raw-index → assigned-id map; a reference to a dropped entry, to the
 * claim itself, or forwards to a claim the model had not written yet is not
 * usable and becomes null.
 */
export function parseDraftClaims(
  json: unknown,
  plainText: string,
  facetIds: ReadonlySet<string>,
  maxClaims = DEFAULT_MAX_DRAFT_CLAIMS,
): DraftClaim[] {
  const entries = arrayField(json, 'claims', 'draft claims reply must have a "claims" array')

  const idByRawIndex = new Map<number, string>()
  const parsed: { claim: DraftClaim; rawIndex: number; restatesIndex: number | null }[] = []

  entries.forEach((entry, rawIndex) => {
    if (parsed.length >= maxClaims) return
    const core = parseClaimCore(entry)
    if (core === null) return
    const record = asRecord(entry) as Record<string, unknown>

    const id = `c${String(parsed.length + 1).padStart(3, '0')}`
    idByRawIndex.set(rawIndex, id)

    const restates = record.restatesClaimIndex
    parsed.push({
      rawIndex,
      restatesIndex: Number.isInteger(restates) ? (restates as number) : null,
      claim: {
        id,
        ...core,
        section: typeof record.section === 'string' ? record.section : null,
        facetId: knownId(record.facetId, facetIds),
        restatesClaimId: null,
        excerptFound: excerptFoundIn(core.excerpt, plainText),
      },
    })
  })

  return parsed.map(({ claim, rawIndex, restatesIndex }) => ({
    ...claim,
    restatesClaimId:
      restatesIndex !== null && restatesIndex < rawIndex
        ? (idByRawIndex.get(restatesIndex) ?? null)
        : null,
  }))
}

/** One claim's judge output. Every 0–1 number is an uncalibrated LLM estimate. */
export interface JudgeSignals {
  duplicateProbability: number
  closestBaselineClaimId: string | null
  internalDuplicateProbability: number
  closestInternalClaimId: string | null
  relevanceByQuery: Record<string, number>
  utility: {
    specificity: number
    actionability: number
    explanatoryPower: number
    audienceFit: number
  }
  /** 0.5–2.0 multiplier; 1 when the judge did not say. */
  importance: number
  containsNumericOrTemporalClaim: boolean
  rationale: string
}

function relevanceByQueryOf(value: unknown, queryIds: ReadonlySet<string>): Record<string, number> {
  const record = asRecord(value)
  const relevance: Record<string, number> = {}
  if (record === null) return relevance
  for (const [queryId, score] of Object.entries(record)) {
    // A query the cluster does not contain cannot carry weight, so ignore it.
    if (!queryIds.has(queryId)) continue
    relevance[queryId] = asProbability(score)
  }
  return relevance
}

/**
 * The judge's per-claim signals, keyed by claim id. Every expected claim must
 * come back — a silently dropped claim would score 0 and look like a genuine
 * verdict — while claims the judge invented are ignored.
 */
export function parseJudgeReply(
  json: unknown,
  expectedClaimIds: readonly string[],
  queryIds: ReadonlySet<string>,
  baselineIds: ReadonlySet<string>,
): Map<string, JudgeSignals> {
  const byId = claimsById(arrayField(json, 'claims', 'judge reply must have a "claims" array'))

  const signals = new Map<string, JudgeSignals>()
  for (const claimId of expectedClaimIds) {
    const record = byId.get(claimId)
    if (record === undefined) throw new Error(`judge reply missing claim ${claimId}`)
    const utility = asRecord(record.utility) ?? {}
    signals.set(claimId, {
      duplicateProbability: asProbability(record.duplicateProbability),
      closestBaselineClaimId: knownId(record.closestBaselineClaimId, baselineIds),
      internalDuplicateProbability: asProbability(record.internalDuplicateProbability),
      closestInternalClaimId: knownId(record.closestInternalClaimId, baselineIds),
      relevanceByQuery: relevanceByQueryOf(record.relevanceByQuery, queryIds),
      utility: {
        specificity: asProbability(utility.specificity),
        actionability: asProbability(utility.actionability),
        explanatoryPower: asProbability(utility.explanatoryPower),
        audienceFit: asProbability(utility.audienceFit),
      },
      importance: Number.isFinite(record.importance)
        ? clampImportance(record.importance as number)
        : 1,
      // Only a literal `true` counts: "true", 1, and "yes" are not a verdict.
      containsNumericOrTemporalClaim: record.containsNumericOrTemporalClaim === true,
      rationale: asText(record.rationale),
    })
  }
  return signals
}

export interface VerifierEvidence {
  url: string
  excerpt: string
  publisher: string | null
  sourceKind: SourceQualityClass | 'unknown'
}

/** One claim's verifier output. `support` and `contradiction` are uncalibrated. */
export interface VerifierSignals {
  support: number
  contradiction: number
  evidence: VerifierEvidence[]
  notes: string | null
}

/**
 * Classes the verifier may assign. `first_party_dataset` is missing on purpose:
 * only the admin's evidence-sources table can certify a source as our own, so a
 * model claiming it falls back to `unknown` (see `resolveSourceQuality`).
 */
const RUBRIC_SOURCE_CLASSES: readonly string[] = SOURCE_QUALITY_CLASSES.filter(
  (sourceClass) => sourceClass !== 'first_party_dataset',
)

/** Citations we can actually check: a URL that parses and a non-empty quote. */
function parseEvidence(value: unknown): VerifierEvidence[] {
  if (!Array.isArray(value)) return []
  const evidence: VerifierEvidence[] = []
  for (const entry of value) {
    const record = asRecord(entry)
    if (record === null) continue
    const url = asTrimmed(record.url)
    const excerpt = asTrimmed(record.excerpt)
    if (url === null || excerpt === null || hostnameOf(url) === null) continue
    const sourceKind = record.sourceKind
    evidence.push({
      url,
      excerpt,
      publisher: asTrimmed(record.publisher),
      sourceKind:
        typeof sourceKind === 'string' && RUBRIC_SOURCE_CLASSES.includes(sourceKind)
          ? (sourceKind as SourceQualityClass)
          : 'unknown',
    })
  }
  return evidence
}

/**
 * The verifier's per-claim signals, keyed by claim id. Unlike the judge, a claim
 * the verifier skipped is not an error — it is an unsupported claim, so it comes
 * back as zeros and the policy gate decides what that means. Support with no
 * surviving citation behind it is likewise forced to 0: an unquotable source
 * supports nothing.
 */
export function parseVerifierReply(
  json: unknown,
  expectedClaimIds: readonly string[],
): Map<string, VerifierSignals> {
  const byId = claimsById(arrayField(json, 'claims', 'verifier reply must have a "claims" array'))

  const signals = new Map<string, VerifierSignals>()
  for (const claimId of expectedClaimIds) {
    const record = byId.get(claimId)
    if (record === undefined) {
      signals.set(claimId, { support: 0, contradiction: 0, evidence: [], notes: null })
      continue
    }
    const evidence = parseEvidence(record.evidence)
    signals.set(claimId, {
      support: evidence.length === 0 ? 0 : asProbability(record.support),
      contradiction: asProbability(record.contradiction),
      evidence,
      notes: asTrimmed(record.notes),
    })
  }
  return signals
}
