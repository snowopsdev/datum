import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { test, expect, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { verifyWebhookSignature } from '../../src/jobs/webhookDeliver.js'
import { login } from '../helpers/login'
import {
  cleanupOpsUser,
  ensureRunReadiness,
  firstTemplateId,
  opsPayload,
  opsTestUser,
  retireArticles,
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
let previousWebhookSettings: { enabled: boolean; url: string | null; secret: string | null }
const deliveries: Delivery[] = []
const seededIds: number[] = []
const WEBHOOK_SECRET = 'e2e-suite-secret'
/** A runnable piece no run is carrying — the state the run controls exist for. */
let researchedId: number

test.describe.configure({ mode: 'serial' })

test.describe('Content ops', () => {
  test.beforeAll(async ({ browser }) => {
    // Seeding here creates the governance assets a run needs, which is more
    // work than the default hook budget allows on a cold database.
    test.setTimeout(120_000)
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
    // The webhook global is a singleton the target database may already
    // configure; snapshot it so teardown restores rather than clobbers it.
    const existing = await payload.findGlobal({ slug: 'webhook-settings', depth: 0 })
    previousWebhookSettings = {
      enabled: existing?.enabled !== false,
      url: existing?.url ?? null,
      secret: existing?.secret ?? null,
    }
    await setWebhookSettings(payload, { enabled: true, url: listenerUrl, secret: WEBHOOK_SECRET })

    // The run controls refuse a workspace that cannot write, so the suite has
    // to be able to answer "yes" before it can test the button.
    await ensureRunReadiness(payload)
    const researched = await seedArticle(payload, {
      // Nothing in the title may contain "Stalled": the test asserts on the
      // header pill by text, and the heading would match it too.
      keyword: `e2e run controls ${Date.now()}`,
      title: 'E2E run controls',
      status: 'researched',
      template: await firstTemplateId(payload),
    })
    researchedId = researched.id
    seededIds.push(researchedId)

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: opsTestUser })
  })

  test.afterAll(async () => {
    // Disable before retiring so the withdrawals queue no deliveries, then
    // put back whatever configuration the database had before the suite.
    await setWebhookSettings(payload, { enabled: false })
    await retireArticles(payload, seededIds)
    await setWebhookSettings(payload, previousWebhookSettings)
    await cleanupOpsUser(payload)
    await new Promise<void>((resolve, reject) =>
      listener.close((err) => (err ? reject(err) : resolve())),
    )
  })

  test('webhooks global renders its settings form with the secret masked', async () => {
    // Payload's edit view posts its form state back to the server on mount and
    // replaces the client state when the answer arrives, so a value typed
    // before that lands is silently discarded. `data-form-ready` flips before
    // those requests answer, so wait for the network to go quiet instead.
    await page.goto('/admin/globals/webhook-settings', { waitUntil: 'networkidle' })
    await expect(page.locator('form[data-form-ready="true"]')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Enabled' })).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Url' })).toHaveValue(listenerUrl)
    // The secret is a shared signing key. It is loaded, so it can be edited
    // and saved, but it is never on screen until someone asks for it.
    const secret = page.locator('#field-secret')
    await expect(secret).toHaveAttribute('type', 'password')
    await expect(secret).toHaveValue(WEBHOOK_SECRET)
    await page.getByRole('button', { name: 'Show secret' }).click()
    await expect(secret).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Hide secret' }).click()
    await expect(secret).toHaveAttribute('type', 'password')
    // A custom field component owns its own form state, so prove a typed
    // secret still reaches the database — then put the suite's own secret
    // back the same way, because the delivery tests sign with it.
    const storedSecret = async () =>
      (await payload.findGlobal({ slug: 'webhook-settings', depth: 0 }))?.secret
    // Saving is three requests, not one: the save itself, then Payload posts
    // the form state back and replaces the client state with the answer. A
    // value typed between the save and that replace is silently discarded, and
    // Save stays disabled because the form no longer counts as modified.
    // `networkidle` is not enough (it fires between them), so wait for the
    // form-state round trip explicitly before typing again.
    const formStateSettled = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/admin/globals/webhook-settings' &&
          (response.request().postData()?.length ?? 0) > 2,
      )
    const rotate = async (next: string) => {
      await secret.fill(next)
      await expect(secret).toHaveValue(next)
      const settled = formStateSettled()
      await page.getByRole('button', { name: 'Save' }).first().click()
      await expect.poll(storedSecret).toBe(next)
      await settled
      await expect(secret).toHaveValue(next)
    }
    await rotate(`${WEBHOOK_SECRET}-rotated`)
    await rotate(WEBHOOK_SECRET)
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
    await expect(page.getByRole('button', { name: 'Publish now' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()
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
    await page.getByRole('button', { name: 'Publish now' }).click()
    // Publishing keeps the reviewer on the article: the page re-renders in
    // place and the panel for the new status replaces the one just used.
    await expect(page.getByText('Published · view it')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/ops/articles/${article.id}`))
    await expect(page.getByRole('heading', { name: 'Live' })).toBeVisible()

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
      verifyWebhookSignature(
        WEBHOOK_SECRET,
        delivery.timestamp,
        delivery.rawBody,
        delivery.signature,
      ),
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

  /**
   * Archiving is offered on every panel a person owns, including the brief —
   * the cheapest moment to drop a topic is before anything has been written
   * for it. The walk ends on the content list because an archive that hid the
   * piece from every tab, Archived included, would be a delete.
   */
  test('a brief awaiting review can be archived and is then findable only under Archived', async () => {
    const keyword = `e2e brief archive ${Date.now()}`
    const article = await seedArticle(payload, {
      keyword,
      title: 'E2E brief archive',
      status: 'brief_review',
      template: await firstTemplateId(payload),
    })
    seededIds.push(article.id)

    await page.goto(`/admin/ops/articles/${article.id}`)
    await page.getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Confirm: archive' }).click()
    await expect(page.getByText('Archived — it is off the content board.')).toBeVisible()

    const search = `?q=${encodeURIComponent(keyword)}&page=1`
    await page.goto(`/admin/ops/content${search}&filter=all`)
    await expect(page.getByRole('link', { name: 'E2E brief archive' })).toHaveCount(0)
    await page.goto(`/admin/ops/content${search}&filter=archived`)
    await expect(page.getByRole('link', { name: 'E2E brief archive' })).toBeVisible()
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

  // `.datum-ops` rather than `main`: the Payload admin shell renders no
  // `<main>`, and this root is exactly the operator-facing copy under test.
  test('no operator copy mentions the CLI', async () => {
    await page.goto(`/admin/ops/articles/${researchedId}`)
    await expect(page.locator('.datum-ops')).not.toContainText('pipeline:run')
  })

  test('a stalled article can be run from the review page', async () => {
    await page.goto(`/admin/ops/articles/${researchedId}`)
    await expect(page.getByText('Stalled')).toBeVisible()
    await page.getByRole('button', { name: 'Run next stage' }).click()
    await expect(page.getByText(/Started a run/)).toBeVisible()
  })

  test('reports page shows the pipeline runs panel', async () => {
    await page.goto('/admin/ops/reports')
    await expect(page.getByRole('heading', { name: 'Pipeline runs' })).toBeVisible()
    await expect(page.getByText(/succeeded: \d+/)).toBeVisible()
    await expect(page.getByText(/queued \/ running: \d+/)).toBeVisible()
  })
})
