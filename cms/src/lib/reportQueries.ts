import type { PayloadRequest, Where } from 'payload'
import type { CostReport, SpendRow } from '../components/ops/ReportsPanel'
import type { StageKpiRow } from './opsKpis'

/** Traverse append-only logs by ID, keeping just aggregates between batches. */
export async function loadReportCosts(
  req: PayloadRequest,
  where: Where,
): Promise<{
  aggregate: Pick<CostReport, 'totalUsd' | 'byStage' | 'byModel' | 'rowCount'>
  stages: StageKpiRow[]
}> {
  let cursor = 0
  let rowCount = 0
  let totalUsd = 0
  const byModel = new Map<string, number>()
  const stages = new Map<string, StageKpiRow>()
  // Pin the upper ID so concurrent appends cannot extend a report indefinitely.
  const newest = await req.payload.find({
    collection: 'cost-log',
    where,
    sort: '-id',
    limit: 1,
    depth: 0,
    select: { costUsd: true },
    user: req.user,
    overrideAccess: false,
  })
  const upper = newest.docs[0]?.id ?? 0
  while (cursor < upper) {
    const result = await req.payload.find({
      collection: 'cost-log',
      where: { and: [where, { id: { greater_than: cursor, less_than_equal: upper } }] },
      sort: 'id',
      limit: 1000,
      pagination: false,
      depth: 0,
      select: { costUsd: true, stage: true, model: true, inputTokens: true, outputTokens: true },
      user: req.user,
      overrideAccess: false,
    })
    if (result.docs.length === 0) break
    for (const row of result.docs) {
      rowCount += 1
      const usd = row.costUsd ?? 0
      totalUsd += usd
      const stage = row.stage ?? '(unknown)'
      const entry = stages.get(stage) ?? {
        stage,
        calls: 0,
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
      }
      entry.calls += 1
      entry.costUsd += usd
      entry.inputTokens += row.inputTokens ?? 0
      entry.outputTokens += row.outputTokens ?? 0
      stages.set(stage, entry)
      const model = row.model ?? '(unknown)'
      byModel.set(model, (byModel.get(model) ?? 0) + usd)
    }
    cursor = result.docs[result.docs.length - 1].id
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
