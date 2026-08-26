import type { Payload } from 'payload'

import type { LlmSettingsDoc } from './llmSettings'
import { evaluateWorkspaceReadiness, type WorkspaceReadiness } from './workspaceReadiness'

export interface PipelineRunSummary {
  id: number | string
  runId: string
  source: 'onboarding' | 'admin' | 'cli'
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  mode: 'mock' | 'live'
  configFingerprint: string
  articles: number[]
  finalStatuses: Record<string, number> | null
  errorSummary: string | null
  createdAt: string
  completedAt: string | null
}

export interface WorkspaceSetupData {
  readiness: WorkspaceReadiness
  templates: Array<{ id: number | string; name: string }>
  latestRun: PipelineRunSummary | null
}

function relationshipIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === 'number') return [item]
    if (item && typeof item === 'object' && 'id' in item) {
      const id = item.id
      return typeof id === 'number' ? [id] : []
    }
    return []
  })
}

export async function loadWorkspaceSetup(payload: Payload): Promise<WorkspaceSetupData> {
  const [voices, templatesResult, settings, runs] = await Promise.all([
    payload.find({
      collection: 'brand-voices',
      where: { status: { equals: 'active' } },
      limit: 1,
      depth: 0,
      sort: '-activatedAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'templates',
      limit: 100,
      pagination: false,
      depth: 0,
      sort: 'name',
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'llm-settings', depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'pipeline-runs',
      limit: 1,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    }),
  ])

  const activeVoice = voices.docs[0]
  const templates = templatesResult.docs.map((template) => ({
    id: template.id,
    name: template.name,
    updatedAt: template.updatedAt,
  }))
  const rawRun = runs.docs[0] as (typeof runs.docs)[number] | undefined
  const articleIds = relationshipIds(rawRun?.articles)
  const article = articleIds[0]
    ? await payload.findByID({
        collection: 'articles',
        id: articleIds[0],
        depth: 0,
        overrideAccess: true,
      })
    : null
  const latestRun = rawRun
    ? ({
        id: rawRun.id,
        runId: rawRun.runId,
        source: rawRun.source,
        status: rawRun.status,
        mode: rawRun.mode,
        configFingerprint: rawRun.configFingerprint,
        articles: articleIds,
        finalStatuses: (rawRun.finalStatuses as Record<string, number> | null | undefined) ?? null,
        errorSummary: rawRun.errorSummary ?? null,
        createdAt: rawRun.createdAt,
        completedAt: rawRun.completedAt ?? null,
      } satisfies PipelineRunSummary)
    : null

  const readiness = evaluateWorkspaceReadiness({
    env: process.env,
    models: settings as LlmSettingsDoc,
    activeVoice: activeVoice ? { id: activeVoice.id, updatedAt: activeVoice.updatedAt } : null,
    templates,
    verification: latestRun
      ? {
          runId: latestRun.runId,
          status: latestRun.status,
          articleStatus: article?.status ?? null,
          configFingerprint: latestRun.configFingerprint,
          completedAt: latestRun.completedAt,
        }
      : null,
  })

  return {
    readiness,
    templates: templates.map(({ id, name }) => ({ id, name })),
    latestRun,
  }
}
