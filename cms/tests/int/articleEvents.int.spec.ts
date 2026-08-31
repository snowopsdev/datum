import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { ARTICLE_STATUS_EVENT } from '@/lib/articleEvents'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

const queuedEvents = async (articleId: number) => {
  const { docs } = await payload.find({
    collection: 'payload-jobs',
    where: { taskSlug: { equals: 'webhook-deliver' } },
    pagination: false,
    sort: 'id',
    overrideAccess: true,
  })
  return docs
    .map((job) => job.input as { event: string; body: Record<string, unknown> })
    .filter((input) => input.body.articleId === articleId)
}

describe('article status events', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: true, url: 'https://receiver.test/hook', secret: 'event-secret' },
    })
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: false, url: null, secret: null },
    })
    await payload.delete({
      collection: 'payload-jobs',
      overrideAccess: true,
      where: { taskSlug: { equals: 'webhook-deliver' } },
    })
  })

  it('queues one signed-delivery job per status transition, none for other edits', async () => {
    const article = await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: {
        keyword: `event test ${randomUUID()}`,
        slug: 'event-test-article',
        status: 'topic_selected',
      },
    })

    let events = await queuedEvents(article.id)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe(ARTICLE_STATUS_EVENT)
    expect(events[0].body).toMatchObject({
      event: ARTICLE_STATUS_EVENT,
      articleId: article.id,
      slug: 'event-test-article',
      from: null,
      to: 'topic_selected',
      actorType: 'system',
    })

    await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { title: 'A title edit, not a transition' },
    })
    events = await queuedEvents(article.id)
    expect(events).toHaveLength(1)

    await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { status: 'brief_review' },
    })
    events = await queuedEvents(article.id)
    expect(events).toHaveLength(2)
    expect(events[1].body).toMatchObject({ from: 'topic_selected', to: 'brief_review' })
    expect(typeof events[1].body.occurredAt).toBe('string')
  })

  it('queues nothing while webhooks are unconfigured', async () => {
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: false, url: null, secret: null },
    })
    const article = await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: { keyword: `event test off ${randomUUID()}`, status: 'topic_selected' },
    })
    expect(await queuedEvents(article.id)).toHaveLength(0)
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: true, url: 'https://receiver.test/hook', secret: 'event-secret' },
    })
  })

  it('carries the pipeline run id when the update supplies audit context', async () => {
    const article = await payload.create({
      collection: 'articles',
      overrideAccess: true,
      data: { keyword: `event test run ${randomUUID()}`, status: 'topic_selected' },
    })
    await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { status: 'brief_review' },
      context: {
        articleAudit: {
          actor: 'pipeline',
          actorType: 'pipeline',
          event: 'research_completed',
          pipelineRunId: 'run-123',
          stage: 'research',
        },
      },
    })
    const events = await queuedEvents(article.id)
    expect(events.at(-1)?.body).toMatchObject({
      actorType: 'pipeline',
      actor: 'pipeline',
      pipelineRunId: 'run-123',
    })
  })
})
