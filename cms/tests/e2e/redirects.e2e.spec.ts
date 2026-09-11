import { expect, test } from '@playwright/test'

test('legacy ops routes redirect', async ({ page }) => {
  const topics = await page.goto('/admin/ops/topics')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/new')
  await page.goto('/admin/ops/articles')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/content')
  const r = await page.request.get('/my-route')
  expect(r.status()).toBe(404)
})
