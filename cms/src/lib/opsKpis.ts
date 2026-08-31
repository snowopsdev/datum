/**
 * Pure aggregations behind the reports page's operational KPIs. Rows in,
 * numbers out — no Payload, so they unit-test without a database and the view
 * stays a thin query-and-render shell.
 */

export type StageKpiRow = {
  stage: string
  calls: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type CostLogLike = {
  stage?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  costUsd?: number | null
}

/** Per-stage LLM activity: how often each stage ran, what it read/wrote/cost. */
export function stageKpis(rows: CostLogLike[]): StageKpiRow[] {
  const byStage = new Map<string, StageKpiRow>()
  for (const row of rows) {
    const stage = row.stage ?? '(unknown)'
    const entry = byStage.get(stage) ?? {
      stage,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    }
    entry.calls += 1
    entry.inputTokens += row.inputTokens ?? 0
    entry.outputTokens += row.outputTokens ?? 0
    entry.costUsd += row.costUsd ?? 0
    byStage.set(stage, entry)
  }
  return [...byStage.values()].sort((a, b) => b.costUsd - a.costUsd)
}

export type RunHealth = {
  total: number
  succeeded: number
  failed: number
  active: number
  recentFailures: { runId: string; errorSummary: string | null; completedAt: string | null }[]
}

type PipelineRunLike = {
  runId: string
  status?: string | null
  errorSummary?: string | null
  completedAt?: string | null
}

const MAX_RECENT_FAILURES = 5

/** Run outcomes for the period; failures carry their (already redacted) summaries. */
export function runHealth(runs: PipelineRunLike[]): RunHealth {
  const health: RunHealth = { total: runs.length, succeeded: 0, failed: 0, active: 0, recentFailures: [] }
  for (const run of runs) {
    if (run.status === 'succeeded') health.succeeded += 1
    else if (run.status === 'failed') health.failed += 1
    else health.active += 1
    if (run.status === 'failed' && health.recentFailures.length < MAX_RECENT_FAILURES) {
      health.recentFailures.push({
        runId: run.runId,
        errorSummary: run.errorSummary ?? null,
        completedAt: run.completedAt ?? null,
      })
    }
  }
  return health
}
