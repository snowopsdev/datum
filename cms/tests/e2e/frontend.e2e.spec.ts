import { test, expect } from '@playwright/test'
import type { Payload } from 'payload'

import { plainTextToLexical } from '../../src/lib/lexicalHtml.js'
import { login } from '../helpers/login'
import {
  cleanupOpsUser,
  opsPayload,
  opsTestUser,
  retireArticles,
  seedArticle,
  seedOpsUser,
} from '../helpers/seedContentOps'

let payload: Payload
const seededIds: number[] = []

test.describe('Frontend', () => {
  test.beforeAll(async () => {
    payload = await opsPayload()
    await seedOpsUser(payload)
  })

  test.afterAll(async () => {
    await retireArticles(payload, seededIds)
    await cleanupOpsUser(payload)
  })

  test('can go on homepage', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle('Datum')

    const heading = page.locator('h1').first()

    await expect(heading).toHaveText('Published articles')
  })

  test('article page renders one FAQ heading', async ({ page }) => {
    const slug = `e2e-faq-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e faq body ${Date.now()}`,
      title: 'E2E FAQ heading',
      slug,
      status: 'published',
      publishedAt: new Date().toISOString(),
      body: plainTextToLexical('## Overview\nSome article body text.'),
      faqItems: [{ question: 'Is this a test?', answer: 'Yes.' }],
    } as never)
    seededIds.push(article.id)

    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 2, name: 'FAQ' })).toHaveCount(1)
  })

  /**
   * The template's own FAQ heading and the reader page's used to be two H2s
   * that both said "FAQ" whenever a body already ended in one. The page now
   * renders its own heading only when the body's last H2 is not already
   * "FAQ" (case-insensitively) — this seeds a body that ends in one.
   */
  test('article page does not duplicate the FAQ heading when the body already ends with one', async ({
    page,
  }) => {
    const slug = `e2e-faq-dup-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e faq dup ${Date.now()}`,
      title: 'E2E FAQ dedup',
      slug,
      status: 'published',
      publishedAt: new Date().toISOString(),
      body: plainTextToLexical('## Overview\nSome article body text.\n## FAQ'),
      faqItems: [{ question: 'Is this deduped?', answer: 'Yes.' }],
    } as never)
    seededIds.push(article.id)

    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 2, name: 'FAQ' })).toHaveCount(1)
  })

  test('public header has no stale admin link', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Article board' })).toHaveCount(0)

    // The header only shows admin links to a signed-in user, so log in before
    // asserting "Admin" is the only one and it points at the content board.
    await login({ page, user: opsTestUser })
    await page.goto('/')
    const adminLink = page.getByRole('link', { name: 'Admin', exact: true })
    await expect(adminLink).toHaveAttribute('href', '/admin/ops/content')
    await expect(page.getByRole('link', { name: 'Article board' })).toHaveCount(0)
  })
})
