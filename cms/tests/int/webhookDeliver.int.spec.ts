import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import config from '@/payload.config'
import {
  EVENT_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  WebhookDeliverTask,
  verifyWebhookSignature,
} from '@/jobs/webhookDeliver'
import { resolveWebhookSettings } from '@/lib/webhookSettings'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

type ReceivedRequest = {
  headers: Record<string, string | string[] | undefined>
  rawBody: string
}

let payload: Payload
let server: Server
let url: string
const received: ReceivedRequest[] = []

// The task handler is exercised directly rather than through the queue: the
// queue's plumbing (retries, autoRun) is Payload's contract, while ours is
// what one delivery attempt sends and when it declines to send at all.
const handler = WebhookDeliverTask.handler as Exclude<typeof WebhookDeliverTask.handler, string>
const runTask = (event: string, body: Record<string, unknown>) =>
  handler({ input: { event, body }, req: { payload } } as never as Parameters<typeof handler>[0])

describe('webhook delivery task', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        received.push({ headers: req.headers, rawBody: Buffer.concat(chunks).toString('utf8') })
        res.writeHead(200).end('ok')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    )
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: false, url: null, secret: null },
    })
  })

  it('delivers a signed POST the receiver can verify', async () => {
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: true, url, secret: 'test-secret' },
    })
    const result = await runTask('article.status_changed', { articleId: 1, from: 'a', to: 'b' })
    expect(result).toMatchObject({ output: { delivered: true, status: 200 } })
    expect(received).toHaveLength(1)
    const hit = received[0]
    expect(hit.headers[EVENT_HEADER]).toBe('article.status_changed')
    expect(JSON.parse(hit.rawBody)).toEqual({ articleId: 1, from: 'a', to: 'b' })
    const signature = String(hit.headers[SIGNATURE_HEADER])
    const timestamp = String(hit.headers[TIMESTAMP_HEADER])
    expect(verifyWebhookSignature('test-secret', timestamp, hit.rawBody, signature)).toBe(true)
    expect(verifyWebhookSignature('wrong-secret', timestamp, hit.rawBody, signature)).toBe(false)
    expect(verifyWebhookSignature('test-secret', timestamp, `${hit.rawBody} `, signature)).toBe(
      false,
    )
  })

  it('does nothing when the kill switch is off', async () => {
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      data: { enabled: false, url, secret: 'test-secret' },
    })
    const before = received.length
    const result = await runTask('article.status_changed', { articleId: 2 })
    expect(result).toMatchObject({ output: { delivered: false } })
    expect(received).toHaveLength(before)
  })

  it('throws (so the queue retries) when the endpoint is down', async () => {
    server.closeAllConnections?.()
    await payload.updateGlobal({
      slug: 'webhook-settings',
      overrideAccess: true,
      // Port 9 (discard) refuses connections on loopback without a listener.
      data: { enabled: true, url: 'http://127.0.0.1:9/hook', secret: 'test-secret' },
    })
    await expect(runTask('article.status_changed', { articleId: 3 })).rejects.toThrow(
      /webhook delivery/,
    )
  })
})

describe('webhook settings resolution', () => {
  const env = { WEBHOOK_URL: 'https://env.example/hook', WEBHOOK_SECRET: 'env-secret' }

  it('admin fields win over env', () => {
    const resolved = resolveWebhookSettings(
      { enabled: true, url: 'https://admin.example/hook', secret: 'admin-secret' },
      env,
    )
    expect(resolved).toEqual({
      url: 'https://admin.example/hook',
      secret: 'admin-secret',
      enabled: true,
      source: 'admin',
    })
  })

  it('falls back to env when the global is empty, even before it is first saved', () => {
    expect(resolveWebhookSettings(null, env)).toEqual({
      url: 'https://env.example/hook',
      secret: 'env-secret',
      enabled: true,
      source: 'env',
    })
  })

  it('an explicit false kill switch beats a complete env config', () => {
    expect(resolveWebhookSettings({ enabled: false }, env).enabled).toBe(false)
  })

  it('stays disabled while either the url or the secret is missing', () => {
    expect(resolveWebhookSettings(null, { WEBHOOK_URL: env.WEBHOOK_URL }).enabled).toBe(false)
    expect(resolveWebhookSettings(null, { WEBHOOK_SECRET: env.WEBHOOK_SECRET }).enabled).toBe(false)
    expect(resolveWebhookSettings(null, {})).toEqual({
      url: null,
      secret: null,
      enabled: false,
      source: 'default',
    })
  })
})
