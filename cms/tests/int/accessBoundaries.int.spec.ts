import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let user: { id: number; collection: 'users' }

const privateCollections = [
  'users', 'articles', 'templates', 'brand-voices', 'brand-voice-files',
  'icps', 'evidence-sources', 'evidence-source-candidates', 'topic-searches',
  'pipeline-runs', 'article-audit', 'governance-audit', 'cost-log',
  'information-gain-runs', 'corpus-snapshots',
] as const
const privateGlobals = [
  'workspace-profile', 'positioning', 'evidence-bank', 'llm-settings',
  'information-gain-policy', 'webhook-settings',
] as const

describe('application access boundaries', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const created = await payload.create({
      collection: 'users',
      data: { email: `access-${randomUUID()}@example.test`, password: randomUUID() },
    })
    user = { id: created.id, collection: 'users' }
  })

  afterAll(async () => {
    if (user) await payload.delete({ collection: 'users', id: user.id })
  })

  it.each(privateCollections)('denies anonymous reads of %s', async (collection) => {
    await expect(payload.find({ collection, overrideAccess: false, limit: 1 }))
      .rejects.toMatchObject({ status: 403 })
  })

  it.each(privateCollections)('permits signed-in reads of %s', async (collection) => {
    const result = await payload.find({ collection, overrideAccess: false, user, limit: 1 })
    expect(Array.isArray(result.docs)).toBe(true)
  })

  it.each(privateGlobals)('denies anonymous reads of %s', async (slug) => {
    await expect(payload.findGlobal({ slug, overrideAccess: false }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('keeps reader media public', async () => {
    const result = await payload.find({ collection: 'media', overrideAccess: false, limit: 1 })
    expect(Array.isArray(result.docs)).toBe(true)
  })

  it.each(['article-audit', 'governance-audit', 'cost-log', 'information-gain-runs', 'pipeline-runs'] as const)(
    'refuses signed-in creation of internal %s records', async (collection) => {
      await expect(payload.create({ collection, overrideAccess: false, user, data: {} as never }))
        .rejects.toMatchObject({ status: 403 })
    },
  )

  it('preserves cost rows when a caller attempts to bypass collection access', async () => {
    const row = await payload.create({
      collection: 'cost-log',
      data: { pipelineRunId: `access-${randomUUID()}`, costUsd: 1.25 },
    })
    await expect(payload.update({ collection: 'cost-log', id: row.id, data: { costUsd: 0 } }))
      .rejects.toThrow('append-only')
    await expect(payload.delete({ collection: 'cost-log', id: row.id })).rejects.toThrow('append-only')
    const retained = await payload.findByID({ collection: 'cost-log', id: row.id })
    expect(retained.costUsd).toBe(1.25)
  })
})
