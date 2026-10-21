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
    })
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
    })
    seededIds.push(article.id)

    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 2, name: 'FAQ' })).toHaveCount(1)
  })

  test('article page ships valid JSON-LD, a dateline and anchored FAQ headings', async ({
    page,
  }) => {
    const slug = `e2e-seo-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e seo ${Date.now()}`,
      title: 'E2E structured data',
      slug,
      status: 'published',
      publishedAt: '2026-01-05T12:00:00.000Z',
      metaDescription: 'A dek for the structured data test.',
      body: plainTextToLexical('## Overview\nSome article body text.'),
      faqItems: [
        { question: 'Is this a test?', answer: 'Yes.' },
        { question: 'Is this a test?', answer: 'Still yes.' },
      ],
    })
    seededIds.push(article.id)

    // A real public edit after publication owns the Updated note.
    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { metaDescription: 'A revised dek for the structured data test.' },
    })

    await page.goto(`/articles/${slug}`)

    const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (text) => JSON.parse(text) as Record<string, unknown>,
    )
    expect(nodes.map((n) => n['@type'])).toEqual(['Article', 'FAQPage', 'BreadcrumbList'])
    expect(nodes[0]).toMatchObject({
      headline: 'E2E structured data',
      datePublished: '2026-01-05T12:00:00.000Z',
      mainEntityOfPage: expect.stringContaining(`/articles/${slug}`),
    })

    const questions = page.locator('.datum-public__faq-item h3')
    await expect(questions).toHaveCount(2)
    const ids = await questions.evaluateAll((els) => els.map((el) => el.id))
    expect(new Set(ids).size).toBe(2)
    expect(ids.every((id) => id.startsWith('faq-'))).toBe(true)

    // Published in January, content edited now: the dateline carries the later date.
    await expect(page.locator('.datum-public__dateline')).toHaveText(
      /^Jan 5, 2026 · 1 min read · Updated \w{3} \d{1,2}, \d{4}$/,
    )
    await expect(page.getByRole('link', { name: 'All articles' })).toHaveAttribute('href', '/')
  })

  test('operational saves do not claim an old article was updated', async ({ page }) => {
    const slug = `e2e-operational-date-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: slug,
      slug,
      title: 'Unchanged public content',
      status: 'published',
      publishedAt: '2026-01-05T12:00:00.000Z',
      body: plainTextToLexical('Some article body text.'),
    })
    seededIds.push(article.id)
    await payload.update({
      collection: 'articles',
      id: article.id,
      data: { reviewNotes: 'Internal note only.' },
    })
    await page.goto(`/articles/${slug}`)
    await expect(page.locator('.datum-public__dateline')).toHaveText('Jan 5, 2026 · 1 min read')
    const node = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) || '{}',
    )
    expect(node.dateModified).toBe('2026-01-05T12:00:00.000Z')
  })

  test('freshly published article has no Updated note', async ({ page }) => {
    const slug = `e2e-fresh-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e fresh ${Date.now()}`,
      title: 'E2E fresh dateline',
      slug,
      status: 'published',
      publishedAt: new Date().toISOString(),
      body: plainTextToLexical('## Overview\nSome article body text.'),
    })
    seededIds.push(article.id)

    await page.goto(`/articles/${slug}`)
    await expect(page.locator('.datum-public__dateline')).toContainText('1 min read')
    await expect(page.locator('.datum-public__dateline')).not.toContainText('Updated')
    // No FAQ items: no FAQPage node.
    const types = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
      (text) => (JSON.parse(text) as { '@type': string })['@type'],
    )
    expect(types).toEqual(['Article', 'BreadcrumbList'])
  })

  test('editor bar is absent for anonymous readers and shown to signed-in editors', async ({
    page,
    request,
  }) => {
    const slug = `e2e-editor-bar-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e editor bar ${Date.now()}`,
      title: 'E2E editor bar',
      slug,
      status: 'published',
      publishedAt: new Date().toISOString(),
      body: plainTextToLexical('## Overview\nSome article body text.'),
    })
    seededIds.push(article.id)

    // The cached HTML is identical for everyone, so the bar is never in it.
    const html = await (await request.get(`/articles/${slug}`)).text()
    expect(html).not.toContain('Edit in Datum')

    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('E2E editor bar')
    await expect(page.getByRole('link', { name: 'Edit in Datum' })).toHaveCount(0)

    await login({ page, user: opsTestUser })
    await page.goto(`/articles/${slug}`)
    await expect(page.getByRole('link', { name: 'Edit in Datum' })).toHaveAttribute(
      'href',
      `/admin/ops/articles/${article.id}`,
    )
  })

  test('home list shows a dek and date per article and no Log in link to readers', async ({
    page,
  }) => {
    const slug = `e2e-home-row-${Date.now()}`
    const article = await seedArticle(payload, {
      keyword: `e2e home row ${Date.now()}`,
      title: 'E2E home row',
      slug,
      status: 'published',
      publishedAt: '2026-10-20T12:00:00.000Z',
      metaDescription: 'Home row dek text.',
      body: plainTextToLexical('## Overview\nSome article body text.'),
    })
    seededIds.push(article.id)

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0)
    const row = page.locator('.datum-home__list li', { hasText: 'E2E home row' })
    await expect(row.locator('.datum-home__item-dek')).toHaveText('Home row dek text.')
    await expect(row.locator('time')).toHaveText('Oct 20, 2026')
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
