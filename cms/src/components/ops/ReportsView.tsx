import type { AdminViewServerProps, Where } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import type { Article, CostLog, PipelineRun } from '../../payload-types'
import { runHealth, stageKpis } from '../../lib/opsKpis'
import { toBoardArticle } from './articleStatus'
import { ReportsPanel, type CostReport, type SpendRow } from './ReportsPanel'

function aggregate(rows: CostLog[]): Pick<CostReport, 'totalUsd' | 'byStage' | 'byModel'> {
  const byStage = new Map<string, number>()
  const byModel = new Map<string, number>()
  let totalUsd = 0
  for (const row of rows) {
    const usd = row.costUsd ?? 0
    totalUsd += usd
    const stage = row.stage ?? '(unknown)'
    const model = row.model ?? '(unknown)'
    byStage.set(stage, (byStage.get(stage) ?? 0) + usd)
    byModel.set(model, (byModel.get(model) ?? 0) + usd)
  }
  const toRows = (m: Map<string, number>): SpendRow[] =>
    [...m.entries()]
      .map(([label, usd]) => ({ label, usd }))
      .sort((a, b) => b.usd - a.usd)
  return { totalUsd, byStage: toRows(byStage), byModel: toRows(byModel) }
}

export async function ReportsView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const rawPeriod = searchParams?.period
  const periodStr = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod
  const period: CostReport['period'] =
    periodStr === 'month' || periodStr === 'all' || periodStr === 'week' ? periodStr : 'week'

  let periodStart: string | null = null
  const costWhere: Where = {}
  if (period !== 'all') {
    const days = period === 'week' ? 7 : 30
    // Period window is evaluated at request time for cost-log filtering.
    // eslint-disable-next-line react-hooks/purity -- server request boundary, not a React render impurity
    periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    costWhere.createdAt = { greater_than_equal: periodStart }
  }

  const [{ docs: articleDocs }, { docs: costDocs }, { docs: runDocs }] = await Promise.all([
    req.payload.find({
      collection: 'articles',
      depth: 1,
      limit: 500,
      pagination: false,
      sort: '-updatedAt',
      user: req.user,
      overrideAccess: false,
    }),
    req.payload.find({
      collection: 'cost-log',
      depth: 0,
      limit: 5000,
      pagination: false,
      sort: '-createdAt',
      where: costWhere,
      user: req.user,
      overrideAccess: false,
    }),
    req.payload.find({
      collection: 'pipeline-runs',
      depth: 0,
      limit: 500,
      pagination: false,
      sort: '-createdAt',
      // Same period window as spend, keyed on createdAt like cost rows.
      where: costWhere,
      user: req.user,
      overrideAccess: false,
    }),
  ])

  const articles = (articleDocs as Article[]).map(toBoardArticle)
  const costsAgg = aggregate(costDocs as CostLog[])
  const costs: CostReport = {
    period,
    periodStart: periodStart ? periodStart.slice(0, 10) : null,
    rowCount: costDocs.length,
    ...costsAgg,
  }
  const stages = stageKpis(costDocs as CostLog[])
  const runs = runHealth(runDocs as PipelineRun[])

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams as Record<string, string | string[] | undefined>}
      user={req.user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <ReportsPanel articles={articles} costs={costs} stages={stages} runs={runs} />
      </Gutter>
    </DefaultTemplate>
  )
}
