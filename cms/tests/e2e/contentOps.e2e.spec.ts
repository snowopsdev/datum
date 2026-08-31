import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { test, expect, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { verifyWebhookSignature } from '../../src/jobs/webhookDeliver.js'
import { login } from '../helpers/login'
import {
  archiveArticles,
  cleanupOpsUser,
  opsPayload,
  opsTestUser,
  seedArticle,
  seedOpsUser,
  setWebhookSettings,
} from '../helpers/seedContentOps'

/**
 * End-to-end walk of the content-ops features shipped in #63: the shared
 * status table's admin rendering, the Webhooks global, publish-with-webhook
 * delivery, the read-only status gate, and the reports KPIs.
 *
 * Scheduled publishing is deliberately absent: its cron occurrence fires on a
 * five-minute boundary, which is unfit for an e2e run. The task handler is
 * covered by `tests/int/publishDue.int.spec.ts`.
 *
 * Webhook delivery relies on the dev server's `autoRun` (development only),
 * which processes the `webhooks` queue every two seconds.
 */

type Delivery = {
  event: string | undefined
  signature: string
  timestamp: string
  rawBody: string
}

let payload: Payload
let page: Page
let listener: Server
let listenerUrl: string
const deliveries: Delivery[] = []
const seededIds: number[] = []
const WEBHOOK_SECRET = 'e2e-suite-secret'

test.describe.configure({ mode: 'serial' })

test.describe('Content ops', () => {
  test.beforeAll(async ({ browser }) => {
    payload = await opsPayload()
    await seedOpsUser(payload)

    listener = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        deliveries.push({
          event: req.headers['x-datum-event'] as string | undefined,
          signature: String(req.headers['x-datum-signature'] ?? ''),
          timestamp: String(req.headers['x-datum-timestamp'] ?? ''),
          rawBody: Buffer.concat(chunks).toString('utf8'),
        })
        res.writeHead(200).end('ok')
      })
    })
    await new Promise<void>((resolve) => listener.listen(0, '127.0.0.1', resolve))
    listenerUrl = `http://127.0.0.1:${(listener.address() as AddressInfo).port}/hook`
    await setWebhookSettings(payload, { enabled: true, url: listenerUrl, secret: WEBHOOK_SECRET })

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: opsTestUser })
  })

  test.afterAll(async () => {
    await setWebhookSettings(payload, { enabled: false })
    await archiveArticles(payload, seededIds)
    await cleanupOpsUser(payload)
    await new Promise<void>((resolve, reject) =>
      listener.close((err) => (err ? reject(err) : resolve())),
    )
  })

  test('webhooks global renders its settings form', async () => {
    await page.goto('/admin/globals/webhook-settings')
    await expect(page.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Url' })).toHaveValue(listenerUrl)
    await expect(page.getByRole('textbox', { name: 'Secret' })).toHaveValue(WEBHOOK_SECRET)
  })

  test('review page renders stage metadata from the shared status table', async () => {
    const article = await seedArticle(payload, {
      keyword: `e2e status table ${Date.now()}`,
      title: 'E2E status table',
      status: 'approved',
    })
    seededIds.push(article.id)

    await page.goto(`/admin/ops/articles/${article.id}`)
    await expect(page.getByText('Needs you · Publish: signed off')).toBeVisible()
    await expect(page.getByRole('list', { name: /stage 5 of 5: publish/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeVisible()
  })

  test('publishing delivers a signed webhook and serves the public page', async () => {
    const slug = `e2e-publish-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e publish ${Date.now()}`,
      title: 'E2E publish walk',
      slug,
      status: 'approved',
    })
    seededIds.push(article.id)

    await page.goto(`/admin/ops/articles/${article.id}`)
    await page.getByRole('button', { name: 'Publish' }).click()
    await page.waitForURL(/\/admin\/ops\/content/)

    // Delivery is asynchronous: the afterChange hook queues a job and dev
    // autoRun drains the webhooks queue every two seconds.
    await expect
      .poll(
        () =>
          deliveries.some((d) => {
            const body = JSON.parse(d.rawBody) as { articleId?: number; to?: string }
            return body.articleId === article.id && body.to === 'published'
          }),
        { timeout: 30_000 },
      )
      .toBe(true)

    const delivery = deliveries.find((d) => {
      const body = JSON.parse(d.rawBody) as { articleId?: number; to?: string }
      return body.articleId === article.id && body.to === 'published'
    })!
    expect(delivery.event).toBe('article.status_changed')
    expect(
      verifyWebhookSignature(WEBHOOK_SECRET, delivery.timestamp, delivery.rawBody, delivery.signature),
    ).toBe(true)
    expect(JSON.parse(delivery.rawBody)).toMatchObject({
      from: 'approved',
      to: 'published',
      slug,
      actorType: 'user',
      actor: opsTestUser.email,
    })

    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 1, name: 'E2E publish walk' })).toBeVisible()
  })

  test('read-only gate blocks content edits while the machine owns the article', async () => {
    const article = await seedArticle(payload, {
      keyword: `e2e readonly ${Date.now()}`,
      title: 'E2E readonly',
      status: 'drafted',
    })
    seededIds.push(article.id)

    await page.goto(`/admin/collections/articles/${article.id}`)
    await page.locator('#field-title').fill('tampered mid-run')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(/read-only until the run finishes/)).toBeVisible()
    // Leave the dirty form so the next navigation is not blocked by the
    // unsaved-changes dialog.
    page.on('dialog', (dialog) => void dialog.accept())
  })

  test('reports page shows the pipeline runs panel', async () => {
    await page.goto('/admin/ops/reports')
    await expect(page.getByRole('heading', { name: 'Pipeline runs' })).toBeVisible()
    await expect(page.getByText(/succeeded: \d+/)).toBeVisible()
    await expect(page.getByText(/queued \/ running: \d+/)).toBeVisible()
  })
})
