import type { AdminViewServerProps, Where } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { redirect } from 'next/navigation'
import React from 'react'

import { runHealth } from '../../lib/opsKpis'
import { summarizeReportArticles } from '../../lib/articleReportSummary'
import { loadReportCosts } from '../../lib/reportQueries'
import { ReportsPanel, type CostReport } from './ReportsPanel'

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

  const [{ docs: articleDocs }, costData, { docs: runDocs }] = await Promise.all([
    req.payload.find({
      collection: 'articles',
      select: {
        title: true,
        keyword: true,
        status: true,
        template: true,
        totalCostUsd: true,
        qaResults: {
          structural: { passed: true, violations: true },
          factCheck: { passed: true, notes: true },
          qualitativeReview: { passed: true, notes: true },
        },
        informationGain: { decision: true },
      },
      populate: { templates: { name: true } },
      depth: 1,
      limit: 0,
      pagination: false,
      sort: '-updatedAt',
      user: req.user,
      overrideAccess: false,
    }),
    loadReportCosts(req, costWhere),
    req.payload.find({
      collection: 'pipeline-runs',
      select: { runId: true, status: true, errorSummary: true, completedAt: true },
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-createdAt',
      // Same period window as spend, keyed on createdAt like cost rows.
      where: costWhere,
      user: req.user,
      overrideAccess: false,
    }),
  ])

  const summary = summarizeReportArticles(
    articleDocs.map((doc) => ({
      ...doc,
      qaResults: doc.qaResults,
      informationGain: doc.informationGain,
      title: doc.title ?? null,
      totalCostUsd: doc.totalCostUsd ?? null,
      templateName: typeof doc.template === 'object' && doc.template ? doc.template.name : null,
    })),
  )
  const costs: CostReport = {
    period,
    periodStart: periodStart ? periodStart.slice(0, 10) : null,
    ...costData.aggregate,
  }
  const stages = costData.stages
  const runs = runHealth(runDocs)

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
        <ReportsPanel summary={summary} costs={costs} stages={stages} runs={runs} />
      </Gutter>
    </DefaultTemplate>
  )
}
