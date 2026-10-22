import { test, expect, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { login } from '../helpers/login'
import {
  cleanupOpsUser,
  opsPayload,
  opsTestUser,
  retireArticles,
  seedArticle,
  seedOpsUser,
} from '../helpers/seedContentOps'

/**
 * F3 + F4 on the review page: motion tokens and reduced motion, the one armed
 * confirm, Undo for archive and unschedule, and the reasoned send-back. Driven
 * from the keyboard wherever the point is that a keyboard can do it.
 */

let payload: Payload
let page: Page
const seededIds: number[] = []

const auditEvents = async (articleId: number) => {
  const { docs } = await payload.find({
    collection: 'article-audit',
    where: { article: { equals: articleId } },
    limit: 100,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
  })
  return docs.map((doc) => doc.event as string)
}

const seed = async (status: 'approved' | 'needs_revision', extra: Record<string, unknown> = {}) => {
  const article = await seedArticle(payload, {
    keyword: `e2e feedback ${status} ${Date.now()}`,
    title: 'E2E feedback',
    status,
    ...extra,
  } as never)
  seededIds.push(article.id)
  return article
}

test.describe.configure({ mode: 'serial' })

test.describe('Review feedback model', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    payload = await opsPayload()
    await seedOpsUser(payload)
    page = await (await browser.newContext()).newPage()
    await login({ page, user: opsTestUser })
  })

  test.afterAll(async () => {
    await retireArticles(payload, seededIds)
    await cleanupOpsUser(payload)
    await page.context().close()
  })

  test('arming a confirm focuses it; Escape disarms and focus returns', async () => {
    const article = await seed('needs_revision')
    await page.goto(`/admin/ops/articles/${article.id}`)
    const confirms = page.getByRole('button', { name: /^Confirm/ })

    await page.getByRole('button', { name: 'Regenerate from gaps' }).click()
    await expect(confirms).toHaveCount(1)
    await expect(page.getByRole('button', { name: /Confirm: discard draft/ })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(confirms).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Regenerate from gaps' })).toBeFocused()
  })

  test('Archive offers Undo that a keyboard reaches, and Undo restores the article', async () => {
    const article = await seed('needs_revision')
    await page.goto(`/admin/ops/articles/${article.id}`)

    // An armed confirm elsewhere is backed out of; Archive itself does not ask.
    await page.getByRole('button', { name: 'Regenerate from gaps' }).click()
    await page.getByRole('button', { name: 'Archive' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /^Confirm/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Archived' })).toBeVisible()

    // Focus lands on the inline Undo chip, not <body>.
    const undo = page.locator('[data-notice-undo]')
    await expect(undo).toBeFocused()
    // …and the same action is on the toast.
    await expect(
      page.locator('.payload-toast-item').getByText('Archived', { exact: true }),
    ).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.getByText('Unarchived — it is back on the content board.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive' })).toBeVisible()

    const doc = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.archived).toBe(false)
    // Append-only: the archive stays on the trail and the undo adds to it.
    const events = await auditEvents(article.id)
    expect(events).toEqual(expect.arrayContaining(['article_archived', 'article_unarchived']))
    expect(events.indexOf('article_archived')).toBeLessThan(events.indexOf('article_unarchived'))
  })

  test('Unschedule offers Undo that restores the prior time', async () => {
    const at = new Date(Date.now() + 3 * 24 * 3600 * 1000)
    at.setUTCSeconds(0, 0)
    const article = await seed('approved', { publishAt: at.toISOString() })
    await page.goto(`/admin/ops/articles/${article.id}`)

    await page.getByRole('button', { name: 'Unschedule' }).click()
    await expect(page.getByText('Unscheduled — it stays approved')).toBeVisible()
    await expect(page.locator('[data-notice-undo]')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/Schedule restored for/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Unschedule' })).toBeVisible()

    const doc = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(new Date(doc.publishAt as string).toISOString()).toBe(at.toISOString())
  })

  test('Send back needs a reason, then an armed confirm, and stores both', async () => {
    const article = await seed('approved')
    await page.goto(`/admin/ops/articles/${article.id}`)

    const send = page.getByRole('button', { name: 'Send back', exact: true })
    await expect(send).toBeDisabled()
    await page.getByLabel(/Why is it going back/).fill('   ')
    await expect(send).toBeDisabled()

    await page.getByRole('button', { name: 'Weak evidence' }).click()
    await expect(page.getByLabel(/Why is it going back/)).toHaveValue('Weak evidence')
    await page.getByLabel(/Why is it going back/).fill('Section 3 cites nothing.')
    await expect(send).toBeEnabled()

    await send.click()
    await expect(page.getByRole('button', { name: 'Confirm: send back' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Resolve' })).toBeVisible()

    const doc = await payload.findByID({
      collection: 'articles',
      id: article.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(doc.status).toBe('needs_revision')
    expect(doc.reviewNotes).toBe('Section 3 cites nothing.')
    const { docs } = await payload.find({
      collection: 'article-audit',
      where: {
        and: [{ article: { equals: article.id } }, { event: { equals: 'article_sent_back' } }],
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(docs[0]?.details).toMatchObject({ reasonCode: 'weak_evidence' })
  })

  test('reduced motion makes tokenised transitions instant, and the run bar scales', async () => {
    const article = await seed('approved')
    await page.goto(`/admin/ops/articles/${article.id}`)
    // The chip and the run-bar fill are measured on probes carrying the real
    // classes: the run bar only exists while a run is active.
    const measure = () =>
      page.evaluate(() => {
        const read = (className: string) => {
          const el = document.createElement('span')
          el.className = className
          document.body.append(el)
          const style = getComputedStyle(el)
          const out = {
            duration: style.transitionDuration,
            property: style.transitionProperty,
            origin: style.transformOrigin,
          }
          el.remove()
          return out
        }
        return { chip: read('datum-ops__chip'), fill: read('datum-runbar__fill') }
      })

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const normal = await measure()
    expect(normal.chip.duration).toContain('0.14s')
    expect(normal.fill.property).toBe('transform')
    expect(normal.fill.duration).toBe('0.36s')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reduced = await measure()
    expect(reduced.chip.duration).toBe('0s, 0s')
    expect(reduced.fill.duration).toBe('0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  })
})
