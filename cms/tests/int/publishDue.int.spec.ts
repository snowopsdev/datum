import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { PublishDueTask } from '@/jobs/publishDue'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

const handler = PublishDueTask.handler as Exclude<typeof PublishDueTask.handler, string>
const runTask = async (): Promise<number[]> => {
  const result = await handler({ input: {}, req: { payload } } as never as Parameters<
    typeof handler
  >[0])
  return (result as { output: { published: number[] } }).output.published
}

const makeArticle = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'articles',
    overrideAccess: true,
    data: { keyword: `publish due ${randomUUID()}`, ...data } as never,
  })

const statusOf = async (id: number) =>
  (await payload.findByID({ collection: 'articles', id, depth: 0, overrideAccess: true })).status

describe('publish-due task', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('publishes due approved articles through the normal path, audit row included', async () => {
    const due = await makeArticle({
      status: 'approved',
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    })
    expect(await runTask()).toContain(due.id)

    const after = await payload.findByID({
      collection: 'articles',
      id: due.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.status).toBe('published')
    expect(after.publishedAt).toBeTruthy()

    const audit = await payload.find({
      collection: 'article-audit',
      where: {
        and: [{ article: { equals: due.id } }, { event: { equals: 'scheduled_publish' } }],
      },
      overrideAccess: true,
    })
    expect(audit.docs).toHaveLength(1)
    expect(audit.docs[0]).toMatchObject({
      actorType: 'system',
      actor: 'scheduler',
      fromStatus: 'approved',
      toStatus: 'published',
    })
  })

  it('leaves future, unapproved, and archived articles alone', async () => {
    const future = await makeArticle({
      status: 'approved',
      publishAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    })
    const wrongStatus = await makeArticle({
      status: 'needs_revision',
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    })
    const archived = await makeArticle({
      status: 'approved',
      archived: true,
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    })
    const published = await runTask()
    for (const article of [future, wrongStatus, archived]) {
      expect(published).not.toContain(article.id)
    }
    expect(await statusOf(future.id)).toBe('approved')
    expect(await statusOf(wrongStatus.id)).toBe('needs_revision')
    expect(await statusOf(archived.id)).toBe('approved')
  })

  it('is convergent: a second run finds nothing to publish', async () => {
    const due = await makeArticle({
      status: 'approved',
      publishAt: new Date(Date.now() - 60_000).toISOString(),
    })
    await runTask()
    expect(await runTask()).not.toContain(due.id)
  })
})
