import type { Payload } from 'payload'

import { codexAuthFilePresent } from './codexAuth'
import type { LlmSettingsDoc } from './llmSettings'
import {
  evidenceBankContentOf,
  icpAudienceLine,
  icpsFromDocs,
  positioningContentOf,
  resolveWorkspaceProfile,
  type WorkspaceProfileDoc,
} from './tenant'
import {
  evaluateWorkspaceReadiness,
  modeFromEnv,
  type WorkspaceReadiness,
} from './workspaceReadiness'

export interface PipelineRunSummary {
  id: number | string
  runId: string
  source: 'onboarding' | 'admin' | 'cli' | 'selected'
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  mode: 'mock' | 'live'
  configFingerprint: string
  articles: number[]
  finalStatuses: Record<string, number> | null
  errorSummary: string | null
  createdAt: string
  completedAt: string | null
}

export interface IcpOption {
  id: number
  name: string
  primary: boolean
  /** The one-line brief audience this ICP derives, so the brief editor can offer it. */
  audienceLine: string
}

export interface WorkspaceSetupData {
  readiness: WorkspaceReadiness
  templates: Array<{ id: number | string; name: string }>
  /** Active audiences, primary first. Empty when setup is not finished. */
  icps: IcpOption[]
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
  const [
    voices,
    templatesResult,
    settings,
    workspaceProfile,
    icpDocs,
    positioningDoc,
    evidenceBankDoc,
    runs,
  ] =
    await Promise.all([
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
      payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'icps',
        where: { status: { equals: 'active' } },
        pagination: false,
        depth: 0,
        sort: ['-primary', 'name'],
        overrideAccess: true,
      }),
      payload.findGlobal({ slug: 'positioning', depth: 0, overrideAccess: true }),
      payload.findGlobal({ slug: 'evidence-bank', depth: 0, overrideAccess: true }),
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
  // Parsed once and used twice: readiness wants ids and timestamps for the
  // fingerprint, the brief editor and the new-content flow want names and the
  // audience line each one derives.
  const icpsForReadiness = icpDocs.docs.map((doc) => ({
    id: doc.id,
    updatedAt: doc.updatedAt,
    name: doc.name,
    primary: doc.primary === true,
  }))
  const icps: IcpOption[] = icpsFromDocs(icpDocs.docs).map((icp) => ({
    id: icp.id as number,
    name: icp.name,
    primary: icp.primary,
    audienceLine: icpAudienceLine(icp),
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
    // Resolved exactly as a run will resolve it, mock default included, so the
    // banner never claims a variable is missing that the run would not miss.
    profile: resolveWorkspaceProfile(workspaceProfile as WorkspaceProfileDoc, process.env, {
      mockDefault: modeFromEnv(process.env) === 'mock',
    }),
    icps: icpsForReadiness,
    // `updatedAt` alongside the content: the evaluator judges completeness from
    // the content and stales a verification run from the timestamp, and a
    // global that has never been saved has neither.
    positioning: {
      content: positioningContentOf(positioningDoc),
      updatedAt: (positioningDoc as { updatedAt?: string | null }).updatedAt ?? null,
    },
    // Same shape, same reason: the counts come from the content and the stale
    // flag from the timestamp. `asOf` is left to default to today, so an
    // operator looking at the hub sees the claims that expired overnight.
    evidenceBank: {
      content: evidenceBankContentOf(evidenceBankDoc),
      updatedAt: (evidenceBankDoc as { updatedAt?: string | null }).updatedAt ?? null,
    },
    verification: latestRun
      ? {
          runId: latestRun.runId,
          status: latestRun.status,
          articleStatus: article?.status ?? null,
          configFingerprint: latestRun.configFingerprint,
          completedAt: latestRun.completedAt,
        }
      : null,
    // The file check, not `checkCodexLogin`: this runs on every admin page
    // load, and spawning a CLI per render is too costly for a banner. The
    // authoritative login check runs once per pipeline run.
    codexLoggedIn: codexAuthFilePresent(process.env),
  })

  return {
    readiness,
    templates: templates.map(({ id, name }) => ({ id, name })),
    icps,
    latestRun,
  }
}
