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

export type RunStatusDTO = {
  runId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  mode: 'mock' | 'live'
  source: string
  startedLabel: string
  articleCount: number
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
