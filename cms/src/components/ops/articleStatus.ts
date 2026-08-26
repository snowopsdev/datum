import type {
  ClaimType,
  Decision,
  PolicyReason,
  QualitySource,
  SourceQualityClass,
  VerificationMode,
} from '../../lib/informationGain/types'
import type { Article, InformationGainRun } from '../../payload-types'

export const ARTICLE_STATUSES = [
  'topic_selected',
  'researched',
  'drafted',
  'qa_passed',
  'verified',
  'needs_review',
  'blocked',
  'needs_revision',
  'approved',
  'published',
] as const

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const STATUS_COLUMNS: {
  id: ArticleStatus
  label: string
  blurb: string
  actionable: boolean
}[] = [
  { id: 'topic_selected', label: 'Topic selected', blurb: 'Assign a template', actionable: true },
  { id: 'researched', label: 'Researched', blurb: 'Pipeline', actionable: false },
  { id: 'drafted', label: 'Drafted', blurb: 'Awaiting QA', actionable: false },
  { id: 'needs_revision', label: 'Needs revision', blurb: 'Triage failures', actionable: true },
  { id: 'qa_passed', label: 'QA passed', blurb: 'Awaiting information gain', actionable: false },
  { id: 'verified', label: 'Verified', blurb: 'Approve or publish', actionable: true },
  { id: 'needs_review', label: 'Needs review', blurb: 'Reviewer decision', actionable: true },
  { id: 'blocked', label: 'Blocked', blurb: 'Override or send back', actionable: true },
  { id: 'approved', label: 'Approved', blurb: 'Ready to publish', actionable: false },
  { id: 'published', label: 'Published', blurb: 'Live', actionable: false },
]

export type BoardArticle = {
  id: number
  title: string | null
  keyword: string
  status: ArticleStatus
  templateName: string | null
  templateId: number | null
  totalCostUsd: number | null
  updatedAt: string
  qaResults: Article['qaResults']
  researchHint: string | null
  metaDescription: string | null
  reviewNotes: string | null
  /**
   * The denormalised summary the scoring stage leaves on the article. It is a
   * *pointer plus headline numbers*, not the scorecard: anything the reviewer
   * reads in detail comes from the `information-gain-runs` row itself, and the
   * review UI cross-checks `informationGain.run` against the run it loaded
   * before presenting the two as one state.
   */
  informationGain: Article['informationGain']
  revisionNotes: string | null
  revisionCount: number | null
}

export function toBoardArticle(doc: Article): BoardArticle {
  const template = doc.template && typeof doc.template === 'object' ? doc.template : null
  return {
    id: doc.id,
    title: doc.title ?? null,
    keyword: doc.keyword,
    status: doc.status,
    templateName: template?.name ?? null,
    templateId: template?.id ?? (typeof doc.template === 'number' ? doc.template : null),
    totalCostUsd: doc.totalCostUsd ?? null,
    updatedAt: doc.updatedAt,
    qaResults: doc.qaResults,
    researchHint: doc.research?.rankingPagesSummary ?? null,
    metaDescription: doc.metaDescription ?? null,
    reviewNotes: doc.reviewNotes ?? null,
    informationGain: doc.informationGain,
    revisionNotes: doc.revisionNotes ?? null,
    revisionCount: doc.revisionCount ?? null,
  }
}

export type TemplateOption = { id: number; name: string }

export type AuditTimelineEntry = {
  id: string
  actor: string
  actorType: 'pipeline' | 'user' | 'system'
  createdAt: string
  createdAtLabel: string
  details: unknown
  event: string
  fromStatus: string | null
  pipelineRunId: string | null
  stage: string | null
  summary: string
  toStatus: string | null
}

export function formatAuditTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return `${new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date)} UTC`
}

/**
 * Human-readable QA failure lines for an article's `qaResults` — structural
 * violations, and the fact-check/qualitative notes when those checks failed.
 * Pure and shared between `ArticleReview.tsx` (triage display) and
 * `actions.ts` (the `regenerateArticleAction` fallback when there is no
 * information-gain run to explain the send-back instead).
 */
export function qaFailureLines(article: { qaResults?: Article['qaResults'] }): string[] {
  const lines: string[] = []
  const qa = article.qaResults
  const raw = qa?.structural?.violations
  if (Array.isArray(raw)) {
    for (const v of raw) {
      if (typeof v === 'string') lines.push(v)
      else if (v && typeof v === 'object' && 'code' in v) {
        const code = String((v as { code: unknown }).code)
        const detail =
          'message' in v && (v as { message?: unknown }).message != null
            ? ` — ${String((v as { message: unknown }).message)}`
            : ''
        lines.push(`${code}${detail}`)
      }
    }
  }
  if (qa?.factCheck?.passed === false && qa.factCheck.notes) {
    lines.push(`Fact: ${qa.factCheck.notes}`)
  }
  if (qa?.qualitativeReview?.passed === false && qa.qualitativeReview.notes) {
    lines.push(`Style: ${qa.qualitativeReview.notes}`)
  }
  return lines
}

/**
 * The `revisionNotes` text `regenerateArticleAction` writes when a reviewer
 * sends an article back for regeneration: one bullet per reason from the
 * latest `information-gain-runs` row, or — when no run exists yet, e.g. an
 * article a reviewer sends back before information-gain ever scored it — one
 * bullet per `qaFailureLines`. The reviewer's own note, when given, is
 * appended last so `generate`'s prompt sees both the machine-found gaps and
 * whatever the human added.
 */
export function buildRegenerateRevisionNotes(
  latestRun: Pick<InformationGainRun, 'reasons'> | null,
  article: { qaResults?: Article['qaResults'] },
  note?: string,
): string {
  const reasons = Array.isArray(latestRun?.reasons)
    ? (latestRun.reasons as { policy?: unknown; message?: unknown }[])
    : null
  const lines =
    reasons && reasons.length > 0
      ? reasons.map((r) => `- [${String(r.policy ?? 'unknown')}] ${String(r.message ?? '')}`)
      : qaFailureLines(article).map((line) => `- ${line}`)
  const trimmedNote = note?.trim()
  const sections = [lines.join('\n'), trimmedNote ? `Reviewer note: ${trimmedNote}` : ''].filter(
    Boolean,
  )
  return sections.join('\n\n')
}

/** One evidence link as the scorecard renders it. */
export type ScorecardEvidence = {
  domain: string
  publisher: string | null
  excerpt: string
  sourceKind: SourceQualityClass | 'unknown'
  /** 0–1, uncalibrated. */
  qualityScore: number | null
  qualitySource: QualitySource | null
  /**
   * The evidence URL, but only when it is `http`/`https`. Evidence URLs are
   * model-authored, so a `javascript:`/`data:` value could otherwise become a
   * clickable script on the reviewer's admin session. Anything else is dropped
   * here — in the pure mapper, so no consumer can accidentally link it — and
   * the row renders the bare domain instead.
   */
  href: string | null
}

/** One claim row of the scorecard table. */
export type ScorecardClaim = {
  id: string
  text: string
  excerpt: string
  section: string | null
  kind: ClaimType | 'unknown'
  /** The four factors of `potentialGain = N·R·U·H`, all uncalibrated. */
  novelty: number | null
  relevance: number | null
  utility: number | null
  intraDocumentNovelty: number | null
  potentialGain: number | null
  verifiedGain: number | null
  evidenceIntegrity: number | null
  verificationMode: VerificationMode | 'unknown'
  blocked: boolean
  requiresHumanReview: boolean
  /** Set from `claimIds.materiallyNovel` / `claimIds.verifiedNovel`, not re-derived. */
  materiallyNovel: boolean
  verifiedNovel: boolean
  evidence: ScorecardEvidence[]
  reasons: PolicyReason[]
}

/**
 * One `information-gain-runs` row, narrowed for rendering. The collection
 * stores `reasons`, `claims`, and `claimIds` as free-form JSON, so every field
 * is coerced here rather than cast: a malformed run must render a blank cell,
 * never `undefined` in the middle of a sentence or a crashed review page.
 *
 * Every 0–1 number in here is an **uncalibrated LLM estimate** (`calibrated`
 * is always `false`); the UI must label them as such wherever it shows them.
 */
export type InformationGainRunView = {
  id: number
  createdAt: string
  createdAtLabel: string
  decision: Decision
  policyVersion: string
  calibrated: boolean
  baselineAvailable: boolean
  scores: {
    /** Weighted share of consensus facets the draft *addresses*. Gated. */
    consensusCoverage: number | null
    potentialGainUnits: number | null
    verifiedGainUnits: number | null
    verificationRatio: number | null
    verifiedGainDensity: number | null
    /** Share of facets some claim delivers verified gain to. Not gated. */
    facetGainCoverage: number | null
    internalDuplicationRate: number | null
  }
  claimSummary: {
    totalClaims: number | null
    materiallyNovelClaims: number | null
    verifiedNovelClaims: number | null
    unsupportedNovelClaims: number | null
    contradictoryClaims: number | null
    firstPartyClaims: number | null
  }
  reasons: PolicyReason[]
  claims: ScorecardClaim[]
  tokenCount: number | null
  costUsd: number | null
}

const DECISIONS: Decision[] = ['PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK']

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function asStringSet(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [])
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

/** `http`/`https` only — see `ScorecardEvidence.href`. */
function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function toPolicyReasons(value: unknown): PolicyReason[] {
  return asRecordArray(value).map((r) => ({
    policy: str(r.policy, 'UNKNOWN') as PolicyReason['policy'],
    claimId: typeof r.claimId === 'string' ? r.claimId : undefined,
    message: str(r.message),
    severity: (r.severity === 'BLOCK' || r.severity === 'HUMAN_REVIEW' || r.severity === 'REVISE'
      ? r.severity
      : 'REVISE') as PolicyReason['severity'],
  }))
}

function toEvidence(value: unknown): ScorecardEvidence[] {
  return asRecordArray(value).map((e) => ({
    domain: str(e.domain) || str(e.publisher) || 'source',
    publisher: typeof e.publisher === 'string' ? e.publisher : null,
    excerpt: str(e.excerpt),
    sourceKind: str(e.sourceKind, 'unknown') as ScorecardEvidence['sourceKind'],
    qualityScore: num(e.qualityScore),
    qualitySource:
      e.qualitySource === 'evidence-sources' ||
      e.qualitySource === 'rubric' ||
      e.qualitySource === 'rubric_capped'
        ? e.qualitySource
        : null,
    href: safeHref(e.url),
  }))
}

/**
 * Narrows one persisted run into what the review UI renders. The novel/verified
 * flags come from the run's own `claimIds` groups — captured at scoring time
 * under that `policyVersion` and explicitly *not* re-derivable — rather than
 * being recomputed here from a threshold this file would have to guess.
 */
export function toRunView(doc: InformationGainRun): InformationGainRunView {
  const materiallyNovel = asStringSet(doc.claimIds?.materiallyNovel)
  const verifiedNovel = asStringSet(doc.claimIds?.verifiedNovel)
  return {
    id: doc.id,
    createdAt: doc.createdAt,
    createdAtLabel: formatAuditTimestamp(doc.createdAt),
    decision: DECISIONS.includes(doc.decision) ? doc.decision : 'HUMAN_REVIEW',
    policyVersion: doc.policyVersion,
    calibrated: doc.calibrated === true,
    baselineAvailable: doc.baselineAvailable === true,
    scores: {
      consensusCoverage: num(doc.scores?.consensusCoverage),
      potentialGainUnits: num(doc.scores?.potentialGainUnits),
      verifiedGainUnits: num(doc.scores?.verifiedGainUnits),
      verificationRatio: num(doc.scores?.verificationRatio),
      verifiedGainDensity: num(doc.scores?.verifiedGainDensity),
      facetGainCoverage: num(doc.scores?.facetGainCoverage),
      internalDuplicationRate: num(doc.scores?.internalDuplicationRate),
    },
    claimSummary: {
      totalClaims: num(doc.claimSummary?.totalClaims),
      materiallyNovelClaims: num(doc.claimSummary?.materiallyNovelClaims),
      verifiedNovelClaims: num(doc.claimSummary?.verifiedNovelClaims),
      unsupportedNovelClaims: num(doc.claimSummary?.unsupportedNovelClaims),
      contradictoryClaims: num(doc.claimSummary?.contradictoryClaims),
      firstPartyClaims: num(doc.claimSummary?.firstPartyClaims),
    },
    reasons: toPolicyReasons(doc.reasons),
    claims: asRecordArray(doc.claims).map((c) => {
      const scored = asRecord(c.scored)
      const id = str(c.id)
      return {
        id,
        text: str(c.text),
        excerpt: str(c.excerpt),
        section: typeof c.section === 'string' ? c.section : null,
        kind: str(c.kind, 'unknown') as ScorecardClaim['kind'],
        novelty: num(c.novelty),
        relevance: num(c.relevance),
        utility: num(c.utility),
        intraDocumentNovelty: num(c.intraDocumentNovelty),
        potentialGain: num(scored.potentialGain),
        verifiedGain: num(scored.verifiedGain),
        evidenceIntegrity: num(scored.evidenceIntegrity),
        verificationMode: str(c.verificationMode, 'unknown') as ScorecardClaim['verificationMode'],
        blocked: scored.blocked === true,
        requiresHumanReview: scored.requiresHumanReview === true,
        materiallyNovel: materiallyNovel.has(id),
        verifiedNovel: verifiedNovel.has(id),
        evidence: toEvidence(c.evidence),
        reasons: toPolicyReasons(scored.reasons),
      }
    }),
    tokenCount: num(doc.tokenCount),
    costUsd: num(doc.costUsd),
  }
}
