import { expect, test } from '@playwright/test'

test('legacy ops routes redirect', async ({ page }) => {
  await page.goto('/admin/ops/topics')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/new')
  await page.goto('/admin/ops/articles')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/content')
  // Brand voice moved in beside the other workspace assets it is edited with.
  await page.goto('/admin/ops/governance/brand-voice')
  expect(new URL(page.url()).pathname).toBe('/admin/ops/setup/brand-voice')
  const r = await page.request.get('/my-route')
  expect(r.status()).toBe(404)
})
