import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

import type {
  Article,
  ArticleAudit,
  CostLog,
  InformationGainRun,
  Template,
} from '../../payload-types'
import { lexicalBodyToHtml } from '../../lib/lexicalHtml'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { ArticleReview } from './ArticleReview'
import type { AuditTimelineEntry } from './articleStatus'
import { formatAuditTimestamp, toBoardArticle, toRunView } from './articleStatus'

export async function ArticleReviewView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const { req, visibleEntities, permissions, locale } = initPageResult

  if (!req.user) {
    redirect('/admin/login')
  }

  const segments = Array.isArray(params?.segments) ? params.segments : []
  const idSegment = segments[2]
  if (!idSegment || Array.isArray(idSegment)) {
    notFound()
  }

  const id = Number(idSegment)
  if (!Number.isFinite(id)) {
    notFound()
  }

  let article: Article
  try {
    article = (await req.payload.findByID({
      collection: 'articles',
      id,
      depth: 1,
      user: req.user,
      overrideAccess: false,
    })) as Article
  } catch {
    notFound()
  }

  const [{ docs: templateDocs }, { docs: auditDocs }, { docs: costDocs }, { docs: runDocs }, setup] =
    await Promise.all([
      req.payload.find({
        collection: 'templates',
        depth: 0,
        limit: 50,
        pagination: false,
        sort: 'name',
        user: req.user,
        overrideAccess: false,
      }),
      req.payload.find({
        collection: 'article-audit',
        where: { article: { equals: article.id } },
        depth: 0,
        limit: 100,
        sort: '-createdAt',
        user: req.user,
        overrideAccess: false,
      }),
      req.payload.find({
        collection: 'cost-log',
        where: { article: { equals: article.id } },
        depth: 0,
        limit: 100,
        sort: '-createdAt',
        user: req.user,
        overrideAccess: false,
      }),
      // The latest scorecard for this article. `ArticleReview` cross-checks its
      // id against `article.informationGain.run` before presenting the two as
      // one state, so a run written after the article's summary was cleared (or
      // an article re-scored since) is shown as stale rather than silently
      // merged with the article's headline numbers.
      req.payload.find({
        collection: 'information-gain-runs',
        where: { article: { equals: article.id } },
        depth: 0,
        limit: 1,
        sort: '-createdAt',
        user: req.user,
        overrideAccess: false,
      }),
      loadWorkspaceSetup(req.payload),
    ])

  const latestRun = (runDocs as InformationGainRun[])[0] ?? null

  const templates = (templateDocs as Template[]).map((t) => ({ id: t.id, name: t.name }))
  const auditEntries: AuditTimelineEntry[] = [
    ...(auditDocs as ArticleAudit[]).map((entry) => ({
      id: `audit-${entry.id}`,
      actor: entry.actor,
      actorType: entry.actorType,
      createdAt: entry.createdAt,
      createdAtLabel: formatAuditTimestamp(entry.createdAt),
      details: entry.details,
      event: entry.event,
      fromStatus: entry.fromStatus ?? null,
      pipelineRunId: entry.pipelineRunId ?? null,
      stage: entry.stage ?? null,
      summary: entry.summary,
      toStatus: entry.toStatus ?? null,
    })),
    ...(costDocs as CostLog[]).map((entry) => ({
      id: `cost-${entry.id}`,
      actor: [entry.provider, entry.model].filter(Boolean).join(' / ') || 'model',
      actorType: 'pipeline' as const,
      createdAt: entry.createdAt,
      createdAtLabel: formatAuditTimestamp(entry.createdAt),
      details: {
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        webSearchRequests: entry.webSearchRequests,
        costUsd: entry.costUsd,
        request: entry.request,
        response: entry.response,
      },
      event: 'model_call_completed',
      fromStatus: null,
      pipelineRunId: entry.pipelineRunId,
      stage: entry.stage ?? null,
      summary: `${entry.stage ?? 'Model'} call completed`,
      toStatus: null,
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

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
        <ArticleReview
          article={toBoardArticle(article)}
          mode={setup.readiness.mode}
          icps={setup.icps}
          templates={templates}
          editHref={`/admin/collections/articles/${article.id}`}
          bodyHtml={lexicalBodyToHtml(article.body)}
          auditEntries={auditEntries}
          run={latestRun ? toRunView(latestRun) : null}
        />
      </Gutter>
    </DefaultTemplate>
  )
}
