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
  { id: 'qa_passed', label: 'QA passed', blurb: 'Awaiting information gain', actionable: true },
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
}

export function toBoardArticle(doc: Article): BoardArticle {
  const template =
    doc.template && typeof doc.template === 'object' ? doc.template : null
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
