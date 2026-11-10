import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, expect, it } from 'vitest'

import config from '@/payload.config'
import * as migration from '@/migrations/20261110_055928_clear_published_publish_at'

type Executor = { execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }

let payload: Payload
const ids: number[] = []
const db = () => (payload.db as unknown as { drizzle: Executor }).drizzle

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})

afterAll(async () => {
  for (const id of ids) {
    await db().execute(sql`UPDATE articles SET archived = true, publish_at = NULL WHERE id = ${id}`)
  }
})

it('clears a stale publishAt on published articles and leaves approved schedules alone', async () => {
  for (let i = 0; i < 2; i += 1) {
    const doc = await payload.create({
      collection: 'articles',
      data: { keyword: `publish-at ${randomUUID()}`, status: 'topic_selected' },
      depth: 0,
    })
    ids.push(doc.id)
  }
  const [published, approved] = ids
  // The state the hook can no longer produce: written straight to the table,
  // as rows published before `stampPublication` existed were left.
  await db().execute(
    sql`UPDATE articles SET status = 'published', publish_at = now() - interval '30 days' WHERE id = ${published}`,
  )
  await db().execute(
    sql`UPDATE articles SET status = 'approved', publish_at = now() + interval '1 day' WHERE id = ${approved}`,
  )

  await migration.up({ db: db(), payload, req: {} } as never)

  const { rows } = await db().execute(
    sql`SELECT id, publish_at FROM articles WHERE id IN (${published}, ${approved})`,
  )
  const publishAt = Object.fromEntries(rows.map((row) => [row.id, row.publish_at]))
  expect(publishAt[published]).toBeNull()
  expect(publishAt[approved]).not.toBeNull()
})
