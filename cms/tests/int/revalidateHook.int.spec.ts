import config from '@/payload.config'
import { POST } from '@/app/hooks/revalidate/route'
import { signWebhookBody, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/jobs/webhookDeliver'
import { ARTICLE_STATUS_EVENT } from '@/lib/articleEvents'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// `revalidatePath` needs Next's request store, which vitest has no way to
// provide; the mock also lets the spec assert exactly which paths purge.
const revalidated = vi.hoisted(() => [] as string[])
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidated.push(path),
}))

const SECRET = 'revalidate-secret'
let payload: Payload

const post = (rawBody: string, headers: Record<string, string>) =>
  POST(
    new Request('http://localhost/hooks/revalidate', {
      method: 'POST',
      body: rawBody,
      headers,
    }),
  )

const signedHeaders = (rawBody: string, timestamp = String(Date.now())) => ({
  [SIGNATURE_HEADER]: signWebhookBody(SECRET, timestamp, rawBody),
  [TIMESTAMP_HEADER]: timestamp,
})

describe('revalidate webhook consumer', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: true, url: 'http://127.0.0.1:9/unused', secret: SECRET },
    })
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: false, url: null, secret: null },
    })
  })

  beforeEach(() => {
    revalidated.length = 0
  })

  it('accepts a signed publish transition and purges both article paths', async () => {
    const rawBody = JSON.stringify({
      event: ARTICLE_STATUS_EVENT,
      articleId: 1,
      slug: 'some-article',
      from: 'approved',
      to: 'published',
    })
    const response = await post(rawBody, signedHeaders(rawBody))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: true })
    expect(revalidated).toEqual(['/articles/1', '/articles/some-article'])
  })

  it('purges the previous slug when an unpublish renamed it in the same save', async () => {
    const rawBody = JSON.stringify({
      event: ARTICLE_STATUS_EVENT,
      articleId: 1,
      slug: 'renamed-article',
      previousSlug: 'original-article',
      from: 'published',
      to: 'needs_revision',
    })
    const response = await post(rawBody, signedHeaders(rawBody))
    expect(response.status).toBe(200)
    expect(revalidated).toEqual([
      '/articles/1',
      '/articles/renamed-article',
      '/articles/1',
      '/articles/original-article',
    ])
  })

  it('acknowledges but ignores transitions that never touch published', async () => {
    const rawBody = JSON.stringify({
      event: ARTICLE_STATUS_EVENT,
      articleId: 1,
      slug: 'some-article',
      from: 'topic_selected',
      to: 'brief_review',
    })
    const response = await post(rawBody, signedHeaders(rawBody))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revalidated: false })
  })

  it('rejects a tampered body', async () => {
    const rawBody = JSON.stringify({ event: ARTICLE_STATUS_EVENT, articleId: 1, to: 'published' })
    const headers = signedHeaders(rawBody)
    const response = await post(rawBody.replace('"articleId":1', '"articleId":2'), headers)
    expect(response.status).toBe(401)
  })

  it('rejects a stale timestamp even with a valid signature', async () => {
    const rawBody = JSON.stringify({ event: ARTICLE_STATUS_EVENT, articleId: 1, to: 'published' })
    const old = String(Date.now() - 6 * 60 * 1000)
    const response = await post(rawBody, signedHeaders(rawBody, old))
    expect(response.status).toBe(401)
  })

  it('rejects unsigned requests', async () => {
    const response = await post('{}', {})
    expect(response.status).toBe(401)
  })

  it.each(['not-a-timestamp', 'NaN', 'Infinity'])('rejects a non-finite timestamp %s', async (timestamp) => {
    const rawBody = JSON.stringify({ event: ARTICLE_STATUS_EVENT, articleId: 1, to: 'published' })
    const response = await post(rawBody, signedHeaders(rawBody, timestamp))
    expect(response.status).toBe(401)
    expect(revalidated).toEqual([])
  })

  it.each([
    null,
    [],
    { event: ARTICLE_STATUS_EVENT, articleId: 1, to: 'published', slug: 42 },
    { event: ARTICLE_STATUS_EVENT, articleId: {}, to: 'published' },
  ].map((body) => ({ body })))('rejects malformed event data without purging paths: $body', async ({ body }) => {
    const rawBody = JSON.stringify(body)
    const response = await post(rawBody, signedHeaders(rawBody))
    expect(response.status).toBe(400)
    expect(revalidated).toEqual([])
  })
})
