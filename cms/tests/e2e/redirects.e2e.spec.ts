import { expect, test } from '@playwright/test'

// Signed out, following a redirect ends on `/admin/login`, which says nothing
// about the redirect itself. Ask for the first response and read it: the
// status and `location` are what the config in `next.config.ts` promises.
// They are temporary (307) so a path can be reused later.
const legacyRoutes: Array<[from: string, to: string]> = [
  ['/admin/ops/topics', '/admin/ops/new'],
  ['/admin/ops/articles', '/admin/ops/content'],
  // Brand voice moved in beside the other workspace assets it is edited with.
  ['/admin/ops/governance/brand-voice', '/admin/ops/setup/brand-voice'],
]

for (const [from, to] of legacyRoutes) {
  test(`legacy ops route ${from} redirects to ${to}`, async ({ page }) => {
    const response = await page.request.get(from, { maxRedirects: 0 })
    expect(response.status()).toBe(307)
    const location = response.headers()['location']
    expect(location, 'location header').toBeTruthy()
    expect(new URL(location, response.url()).pathname).toBe(to)
  })
}

test('an unknown route is a 404, not a redirect', async ({ page }) => {
  const r = await page.request.get('/my-route', { maxRedirects: 0 })
  expect(r.status()).toBe(404)
})
