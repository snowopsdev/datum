import config from '@/payload.config'
import { checklistRows, type SetupChecklistData } from '@/components/ops/SetupChecklist'
import { loadSetupChecklistData } from '@/components/ops/setupChecklistData'
import { llmSettingsConfigured } from '@/lib/llmSettings'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

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

describe('loadSetupChecklistData', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
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
