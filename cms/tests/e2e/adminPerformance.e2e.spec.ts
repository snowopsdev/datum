import { randomUUID } from 'node:crypto'
import { test, expect } from '@playwright/test'
import type { Payload } from 'payload'
import { opsPayload, retireArticles, seedArticle } from '../helpers/seedContentOps'

const marker = `pagination-${randomUUID()}`
const user = { email: `${marker}@test.local`, password: 'test-password' }
const ids: number[] = []
let payload: Payload

test.beforeAll(async () => {
  payload = await opsPayload()
  await payload.create({ collection: 'users', data: user })
  for (let i = 0; i < 56; i++) {
    const article = await seedArticle(payload, {
      keyword: `${marker} topic ${i}`,
      title: `${marker} title ${i}`,
      status: 'topic_selected',
    })
    ids.push(article.id)
  }
  await payload.create({
    collection: 'cost-log',
    overrideAccess: true,
    data: {
      article: ids[0],
      pipelineRunId: marker,
      stage: 'generate',
      request: { prompt: 'DEFERRED_EVIDENCE_SENTINEL' },
      response: { text: 'Full model response' },
    },
  })
})
test.afterAll(async () => {
  await retireArticles(payload, ids)
  await payload.delete({ collection: 'users', where: { email: { equals: user.email } } })
})
test.beforeEach(async ({ page }) => {
  const result = await page.request.post('/api/users/login', { data: user })
  expect(result.ok()).toBe(true)
})

test('content pagination, search, selection, and browser history', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`/admin/ops/content?filter=all&q=${marker}&page=1`)
  await expect(page.locator('.datum-content__row')).toHaveCount(50)
  const checkbox = page.getByRole('checkbox').first()
  await checkbox.check()
  await expect(page.getByText('1 topic selected')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.locator('.datum-content__row')).toHaveCount(6)
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/page=1/)
  await expect(page.locator('.datum-content__row')).toHaveCount(50)
  const search = page.getByRole('searchbox', { name: 'Search content' })
  await search.fill(`${marker} topic 0`)
  await expect(page.locator('.datum-content__row')).toHaveCount(1)
  await expect(page.locator('.datum-content__row')).toContainText(`${marker} title 0`)
  await page.goBack()
  await expect(search).toHaveValue(marker)
  await expect(page.locator('.datum-content__row')).toHaveCount(50)
  await page.goForward()
  await expect(search).toHaveValue(`${marker} topic 0`)
  await expect(page.locator('.datum-content__row')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('review loads model evidence once on expansion', async ({ page }) => {
  const response = await page.goto(`/admin/ops/articles/${ids[0]}`)
  expect(await response?.text()).not.toContain('DEFERRED_EVIDENCE_SENTINEL')
  const entry = page
    .locator('.datum-ops__timeline-item')
    .filter({ hasText: 'generate call completed' })
  await entry.getByText('Evidence', { exact: true }).click()
  await expect(entry.locator('pre')).toContainText('DEFERRED_EVIDENCE_SENTINEL')
  let requests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST') requests++
  })
  await entry.getByText('Evidence', { exact: true }).click()
  await entry.getByText('Evidence', { exact: true }).click()
  await expect(entry.locator('pre')).toContainText('Full model response')
  expect(requests).toBe(0)
})

test('reports render summaries and switch period', async ({ page }) => {
  await page.goto('/admin/ops/reports?period=all')
  await expect(page.getByRole('heading', { name: 'Reports', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Spend by stage' })).toBeVisible()
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page).toHaveURL(/period=month/)
  await expect(page.getByRole('heading', { name: 'Pipeline runs' })).toBeVisible()
})

test('typing survives an older search response and Back cancels pending debounce', async ({
  page,
}) => {
  await page.goto(`/admin/ops/content?filter=all&q=${marker}&page=1`)
  const search = page.getByRole('searchbox', { name: 'Search content' })
  const firstQuery = `${marker} topic 1`
  const newerQuery = `${marker} topic 12`
  let release: () => void = () => {
    throw new Error('Search request not intercepted')
  }
  let intercepted: () => void = () => {}
  const requestStarted = new Promise<void>((resolve) => {
    intercepted = resolve
  })
  await page.route('**/admin/ops/content?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('q') !== firstQuery) return route.continue()
    const response = await route.fetch()
    await new Promise<void>((resolve) => {
      release = resolve
      intercepted()
    })
    await route.fulfill({ response })
  })
  await search.fill(firstQuery)
  await requestStarted
  await search.fill(newerQuery)
  release()
  await expect(search).toHaveValue(newerQuery)
  await expect(page).toHaveURL(
    new RegExp('q=' + encodeURIComponent(newerQuery).replace(/%20/g, '\\+')),
  )
  await expect(page.locator('.datum-content__row')).toHaveCount(1)
  await page.unrouteAll({ behavior: 'wait' })
  await search.fill('abandoned search')
  await page.goBack()
  const restoredURL = page.url()
  await expect(search).not.toHaveValue('abandoned search')
  // Observe beyond the debounce window: it must not create a new history entry.
  await page.waitForTimeout(500)
  expect(page.url()).toBe(restoredURL)
})

test('search keeps the requested tab while its response is delayed', async ({ page }) => {
  await page.goto(`/admin/ops/content?filter=all&q=${marker}&page=1`)
  let release: () => void = () => {
    throw new Error('Tab request not intercepted')
  }
  let intercepted: () => void = () => {}
  const requestStarted = new Promise<void>((resolve) => {
    intercepted = resolve
  })
  await page.route('**/admin/ops/content?**', async (route) => {
    const params = new URL(route.request().url()).searchParams
    if (params.get('filter') !== 'done' || params.get('q') !== marker) return route.continue()
    const response = await route.fetch()
    await new Promise<void>((resolve) => {
      release = resolve
      intercepted()
    })
    await route.fulfill({ response })
  })
  await page.getByRole('tab', { name: /Done/ }).click()
  await requestStarted
  const query = `${marker} new search`
  await page.getByRole('searchbox', { name: 'Search content' }).fill(query)
  try {
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('filter') === 'done' && url.searchParams.get('q') === query,
    )
    await expect(page.getByRole('tab', { name: /Done/ })).toHaveAttribute('aria-selected', 'true')
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
