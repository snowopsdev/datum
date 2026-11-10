import type { Payload, TypedUser } from 'payload'

import { llmSettingsConfigured, type LlmSettingsDoc } from './llmSettings'
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

/** What the setup data keeps of the newest run: whether one is still active. */
export interface PipelineRunSummary {
  status: 'queued' | 'running' | 'succeeded' | 'failed'
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
  /**
   * Whether anybody has chosen a model on the `llm-settings` global. Readiness
   * itself only reports the resolved model per stage, which cannot tell a
   * deliberate choice from the platform default.
   */
  modelsConfigured: boolean
  /** Active audiences, primary first. Empty when setup is not finished. */
  icps: IcpOption[]
  latestRun: PipelineRunSummary | null
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
  ] = await Promise.all([
    payload.find({
      collection: 'brand-voices',
      select: { updatedAt: true },
      where: { status: { equals: 'active' } },
      limit: 1,
      depth: 0,
      sort: '-activatedAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'templates',
      select: { name: true, updatedAt: true },
      limit: 100,
      pagination: false,
      depth: 0,
      sort: 'name',
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'llm-settings', depth: 0, overrideAccess: true }),
    payload.findGlobal({
      slug: 'workspace-profile',
      select: { sitePages: false },
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'icps',
      select: { name: true, primary: true, who: true, pains: true, updatedAt: true },
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
      select: { status: true },
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
  const latestRun: PipelineRunSummary | null = runs.docs[0] ? { status: runs.docs[0].status } : null

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
    // the content, and the fingerprint from the timestamp, and a global that
    // has never been saved has neither.
    positioning: {
      content: positioningContentOf(positioningDoc),
      updatedAt: (positioningDoc as { updatedAt?: string | null }).updatedAt ?? null,
    },
    // Same shape, same reason: the counts come from the content and the
    // fingerprint from the timestamp. `asOf` is left to default to today, so an
    // operator looking at the hub sees the claims that expired overnight.
    evidenceBank: {
      content: evidenceBankContentOf(evidenceBankDoc),
      updatedAt: (evidenceBankDoc as { updatedAt?: string | null }).updatedAt ?? null,
    },
  })

  return {
    readiness,
    templates: templates.map(({ id, name }) => ({ id, name })),
    modelsConfigured: llmSettingsConfigured(settings as LlmSettingsDoc),
    icps,
    latestRun,
  }
}

/** Audience options without loading the full workspace checklist. */
export async function loadActiveAudienceOptions(
  payload: Payload,
  user: TypedUser,
): Promise<IcpOption[]> {
  const { docs } = await payload.find({
    collection: 'icps',
    where: { status: { equals: 'active' } },
    depth: 0,
    pagination: false,
    sort: ['-primary', 'name'],
    user,
    overrideAccess: false,
    select: { name: true, primary: true, who: true, pains: true },
  })
  return docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    primary: doc.primary === true,
    audienceLine: icpAudienceLine(icpsFromDocs([doc])[0]),
  }))
}
