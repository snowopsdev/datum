import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload
let user: { id: number; collection: 'users' }

const privateCollections = [
  'users', 'articles', 'templates', 'brand-voices', 'brand-voice-files',
  'icps', 'evidence-sources', 'evidence-source-candidates', 'topic-searches',
  'setup-suggestions', 'pipeline-runs', 'article-audit', 'governance-audit', 'cost-log',
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

  it.each(['article-audit', 'governance-audit', 'cost-log', 'information-gain-runs', 'pipeline-runs', 'setup-suggestions'] as const)(
    'refuses signed-in creation of internal %s records', async (collection) => {
      await expect(payload.create({ collection, overrideAccess: false, user, data: {} as never }))
        .rejects.toMatchObject({ status: 403 })
    },
  )

  // `informationGain` is the scoring stage's to write. The update half of that
  // was already closed; on create the group was writable, and the verified gate
  // reads the incoming decision when there is no stored document to read.
  it('refuses a signed-in create that hands itself a PASS and a verified status', async () => {
    await expect(
      payload.create({
        collection: 'articles',
        overrideAccess: false,
        user,
        data: {
          keyword: `self-scored ${randomUUID()}`,
          status: 'verified',
          informationGain: { decision: 'PASS' },
        } as never,
      }),
    ).rejects.toThrow(/reaches verified only/)
  })

  // The whole hook chain, through the collection, as a signed-in person.
  it('refuses a signed-in jump from a draft to published, and a create at published', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: { keyword: `unreviewed ${randomUUID()}`, status: 'drafted' } as never,
    })
    try {
      for (const status of ['approved', 'published'] as const) {
        await expect(
          payload.update({
            collection: 'articles',
            id: article.id,
            overrideAccess: false,
            user,
            data: { status },
          }),
        ).rejects.toThrow(`cannot move from drafted to ${status}`)
      }
      await expect(
        payload.create({
          collection: 'articles',
          overrideAccess: false,
          user,
          data: { keyword: `born published ${randomUUID()}`, status: 'published' } as never,
        }),
      ).rejects.toThrow('cannot be created as published')
    } finally {
      await payload.update({ collection: 'articles', id: article.id, data: { archived: true } })
    }
  })

  // Every article has audit rows, and `article_audit.article_id` is NOT NULL
  // with ON DELETE SET NULL, so a delete could only ever fail in the database.
  // Archiving is how a piece is set aside.
  it('refuses to delete an article instead of failing in the database', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: { keyword: `undeletable ${randomUUID()}` } as never,
    })
    try {
      await expect(
        payload.delete({ collection: 'articles', id: article.id, overrideAccess: false, user }),
      ).rejects.toMatchObject({ status: 403 })
    } finally {
      await payload.update({ collection: 'articles', id: article.id, data: { archived: true } })
    }
  })

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
