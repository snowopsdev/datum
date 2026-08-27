/**
 * Types shared by the board's client components and its server actions.
 *
 * Separate from the actions module because `'use server'` may only export async
 * functions — the same reason `topicDiscoveryTypes.ts` exists.
 */

export type RunFailureDTO = {
  articleId: number
  keyword: string
  stage: string
  message: string
}

/** One article in an active run, so the bar can say what is actually moving. */
export type RunArticleDTO = {
  id: number
  keyword: string
  status: string
}

/**
 * How far through the pipeline each status is.
 *
 * A run walks research → generate → qa → informationGain, so an article's
 * status *is* its progress. Nothing tracks a stage counter on the run row, and
 * nothing needs to: the articles already say where they got to.
 */
export const STAGE_PROGRESS: Record<string, { step: number; label: string }> = {
  topic_selected: { step: 0, label: 'Researching' },
  researched: { step: 1, label: 'Writing the draft' },
  drafted: { step: 2, label: 'Running QA checks' },
  qa_passed: { step: 3, label: 'Scoring information gain' },
}

export const TOTAL_STAGES = 4

/** Mean completion across a run's articles, 0–1. Settled articles count as done. */
export function runProgress(articles: RunArticleDTO[]): number {
  if (articles.length === 0) return 0
  const total = articles.reduce(
    (sum, a) => sum + (STAGE_PROGRESS[a.status]?.step ?? TOTAL_STAGES),
    0,
  )
  return Math.min(1, total / (articles.length * TOTAL_STAGES))
}

export type RunStatusDTO = {
  runId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  mode: 'mock' | 'live'
  source: string
  startedLabel: string
  /** ISO, so the bar can tick an elapsed counter rather than a fixed string. */
  startedAtIso: string | null
  articleCount: number
  /** Populated while a run is in flight; empty once it has settled. */
  articles: RunArticleDTO[]
  /** When it actually finished — the bar lingers from this, not from page load. */
  completedAtIso: string | null
  /** `{ verified: 2, needs_revision: 1 }` — what the run actually achieved. */
  finalStatuses: Record<string, number>
  failures: RunFailureDTO[]
  errorSummary: string | null
}

/**
 * `PipelineRun.warnings` is a JSON column, so anything could be in it — an older
 * row predates the shape entirely. Keep only entries that are actually usable
 * rather than letting a malformed one throw inside a render.
 */
export function toRunFailures(raw: unknown): RunFailureDTO[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const { articleId, keyword, stage, message } = entry as Record<string, unknown>
    if (typeof stage !== 'string' || typeof message !== 'string') return []
    return [
      {
        articleId: typeof articleId === 'number' ? articleId : 0,
        keyword: typeof keyword === 'string' ? keyword : 'this article',
        stage,
        message,
      },
    ]
  })
}
