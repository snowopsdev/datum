import { sql } from '@payloadcms/db-postgres'
import { executeAccess, Forbidden, type PayloadRequest } from 'payload'
import type { CostReport, SpendRow } from '../components/ops/ReportsPanel'
import type { StageKpiRow } from './opsKpis'

/** The report's supported filters, bound as values rather than SQL fragments. */
export type ReportCostFilter = {
  createdAtFrom?: string
  pipelineRunId?: string
}

/** Aggregate in one database snapshot without hydrating individual cost logs. */
export async function loadReportCosts(
  req: PayloadRequest,
  filter: ReportCostFilter,
): Promise<{
  aggregate: Pick<CostReport, 'totalUsd' | 'byStage' | 'byModel' | 'rowCount'>
  stages: StageKpiRow[]
}> {
  const access = await executeAccess({ req }, req.payload.collections['cost-log'].config.access.read)
  // CostLog grants all rows to authenticated users. Fail closed if that policy
  // ever becomes row-scoped, rather than silently bypassing a new constraint.
  if (access !== true) throw new Forbidden(req.t)

  const conditions = [sql`true`]
  if (filter.createdAtFrom !== undefined) {
    conditions.push(sql`created_at >= ${filter.createdAtFrom}::timestamptz`)
  }
  if (filter.pipelineRunId !== undefined) {
    conditions.push(sql`pipeline_run_id = ${filter.pipelineRunId}`)
  }
  const grouped = await req.payload.db.drizzle.execute<{
    stage: string | null
    model: string | null
    calls: string
    cost_usd: string
    input_tokens: string
    output_tokens: string
  }>(sql`
    SELECT stage, model, count(*) AS calls,
      coalesce(sum(cost_usd), 0) AS cost_usd,
      coalesce(sum(input_tokens), 0) AS input_tokens,
      coalesce(sum(output_tokens), 0) AS output_tokens
    FROM ${req.payload.db.tables.cost_log}
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY stage, model
  `)

  let rowCount = 0
  let totalUsd = 0
  const byModel = new Map<string, number>()
  const stages = new Map<string, StageKpiRow>()
  for (const row of grouped.rows) {
    const calls = Number(row.calls)
    const usd = Number(row.cost_usd)
    rowCount += calls
    totalUsd += usd
    const stage = row.stage ?? '(unknown)'
    const entry = stages.get(stage) ?? {
      stage,
      calls: 0,
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    }
    entry.calls += calls
    entry.costUsd += usd
    entry.inputTokens += Number(row.input_tokens)
    entry.outputTokens += Number(row.output_tokens)
    stages.set(stage, entry)
    const model = row.model ?? '(unknown)'
    byModel.set(model, (byModel.get(model) ?? 0) + usd)
  }
  const stageRows = [...stages.values()].sort((a, b) => b.costUsd - a.costUsd)
  const modelRows: SpendRow[] = [...byModel]
    .map(([label, usd]) => ({ label, usd }))
    .sort((a, b) => b.usd - a.usd)
  return {
    aggregate: {
      totalUsd,
      rowCount,
      byModel: modelRows,
      byStage: stageRows.map(({ stage, costUsd }) => ({ label: stage, usd: costUsd })),
    },
    stages: stageRows,
  }
}
