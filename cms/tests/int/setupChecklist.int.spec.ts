import config from '@/payload.config'
import { checklistRows, type SetupChecklistData } from '@/components/ops/SetupChecklist'
import { llmSettingsConfigured } from '@/lib/llmSettings'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import type { WorkspaceSetupData } from '@/lib/loadWorkspaceReadiness'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type Payload } from 'payload'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * The hub reads the real workspace unless a test hands it one, which is how
 * "no templates" can be asked about without emptying the development
 * database everything else in this suite reads.
 */
const stub = vi.hoisted(() => ({ setup: null as WorkspaceSetupData | null }))
vi.mock('@/lib/loadWorkspaceReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/loadWorkspaceReadiness')>()
  return {
    ...actual,
    loadWorkspaceSetup: async (payload: Payload) => stub.setup ?? actual.loadWorkspaceSetup(payload),
  }
})

const { loadSetupChecklistData } = await import('@/components/ops/setupChecklistData')

afterEach(() => {
  stub.setup = null
})

/**
 * A workspace with no template cannot make a piece and a workspace with no
 * model choice is spending platform defaults without knowing it. Neither was
 * on the setup hub, so both were invisible until a run refused.
 */
const readyData: SetupChecklistData = {
  mode: 'mock',
  ready: true,
  voice: { name: 'House voice', active: true },
  workspace: {
    ready: true,
    targetDomain: 'acme.example',
    source: 'admin',
    competitorCount: 2,
    sitePages: 3,
    sitePagesFetchedLabel: '2026-09-01 10:00 UTC',
  },
  audiences: { ready: true, count: 2, primaryName: 'Ops lead' },
  positioning: { status: 'ready', problems: [] },
  evidence: { status: 'ready', usable: 3, expired: 0, incomplete: 0, rejected: 0, facts: 2 },
  templateCount: 4,
  modelsConfigured: true,
  modelsFromEnv: false,
}

describe('checklistRows', () => {
  it('has a required templates row and a recommended models row', () => {
    const rows = checklistRows({ ...readyData, templateCount: 0, modelsConfigured: false })

    expect(rows.find((row) => row.id === 'templates')).toMatchObject({
      required: true,
      done: false,
      href: '/admin/ops/templates',
    })
    expect(rows.find((row) => row.id === 'models')).toMatchObject({
      required: false,
      done: false,
      href: '/admin/globals/llm-settings',
    })
  })

  it('marks both done once the workspace has templates and a model choice', () => {
    const rows = checklistRows(readyData)

    expect(rows.find((row) => row.id === 'templates')).toMatchObject({ required: true, done: true })
    expect(rows.find((row) => row.id === 'models')).toMatchObject({ required: false, done: true })
    expect(rows.filter((row) => row.required).map((row) => row.id)).toEqual([
      'workspace',
      'voice',
      'audiences',
      'templates',
    ])
  })
})

describe('llmSettingsConfigured', () => {
  it('is false for a global nobody has filled in, true for any one of the nine fields', () => {
    expect(llmSettingsConfigured(null)).toBe(false)
    expect(llmSettingsConfigured({ generateModel: '  ' })).toBe(false)
    expect(llmSettingsConfigured({ generateModel: 'claude-sonnet-5' })).toBe(true)
    expect(llmSettingsConfigured({ setupAssistModel: 'claude-haiku-4-5' })).toBe(true)
    expect(llmSettingsConfigured({ brandVoiceExtractModel: 'claude-haiku-4-5' })).toBe(true)
  })
})

describe('the Models row', () => {
  it('says where the choice came from rather than claiming defaults', () => {
    const platform = checklistRows({ ...readyData, modelsConfigured: false })
    expect(platform.find((row) => row.id === 'models')).toMatchObject({
      done: false,
      state: 'Platform defaults everywhere',
    })

    // PIPELINE_MODEL_* is a choice somebody made; saying "defaults" there is
    // the same lie the placeholder domain was.
    const fromEnv = checklistRows({ ...readyData, modelsConfigured: false, modelsFromEnv: true })
    expect(fromEnv.find((row) => row.id === 'models')).toMatchObject({
      done: true,
      state: 'Set by PIPELINE_MODEL_* in the environment',
    })
  })
})

describe('loadSetupChecklistData', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('is not ready with a governed workspace that has no template', async () => {
    // `governance.ready` alone offered "Make your first piece" to a workspace
    // with no template, and following it landed on a screen that could only
    // refuse.
    const readiness = evaluateWorkspaceReadiness({
      env: { MOCK_MODE: 'true' },
      models: null,
      activeVoice: { id: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
      templates: [],
      profile: resolveWorkspaceProfile(null, {}, { mockDefault: true }),
      icps: [{ id: 1, updatedAt: '2026-01-01T00:00:00.000Z', name: 'Ops lead', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-01-01' },
    })
    expect(readiness.governance.ready).toBe(true)
    expect(readiness.content.ready).toBe(false)
    stub.setup = { readiness, templates: [], modelsConfigured: false, icps: [], latestRun: null }

    const data = await loadSetupChecklistData(payload)

    expect(data.ready).toBe(false)
    expect(data.templateCount).toBe(0)
    expect(checklistRows(data).find((row) => row.id === 'templates')).toMatchObject({
      required: true,
      done: false,
    })
  })

  it('counts the workspace templates and reports whether models are chosen', async () => {
    const templates = await payload.count({ collection: 'templates', overrideAccess: true })
    const settings = await payload.findGlobal({
      slug: 'llm-settings',
      depth: 0,
      overrideAccess: true,
    })

    const data = await loadSetupChecklistData(payload)

    expect(data.templateCount).toBe(templates.totalDocs)
    expect(data.modelsConfigured).toBe(llmSettingsConfigured(settings))
  })
})
