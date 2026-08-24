import type { Article } from '../../payload-types'

export const ARTICLE_STATUSES = [
  'topic_selected',
  'researched',
  'drafted',
  'needs_revision',
  'qa_passed',
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
  { id: 'qa_passed', label: 'QA passed', blurb: 'Approve / publish', actionable: true },
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
