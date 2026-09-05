import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { loadWorkspaceSetup } from '../../src/lib/loadWorkspaceReadiness'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page
  let dashboardPath: '/admin' | '/admin/ops/content'

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()

    const payload = await getPayload({ config })
    const [setup, articles] = await Promise.all([
      loadWorkspaceSetup(payload),
      payload.count({ collection: 'articles', where: { archived: { not_equals: true } } }),
    ])
    dashboardPath =
      setup.readiness.governance.ready && articles.totalDocs > 0 ? '/admin/ops/content' : '/admin'

    const context = await browser.newContext()
    page = await context.newPage()

    await login({ dashboardPath, page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async () => {
    await page.goto('/admin')
    expect(new URL(page.url()).pathname).toBe(dashboardPath)
    const heading = page.getByRole('heading', { level: 1 }).first()
    if (dashboardPath === '/admin/ops/content') {
      await expect(heading).toHaveText('Content')
    } else {
      await expect(page.locator('span[title="Dashboard"]').first()).toBeVisible()
      await expect(heading).toHaveText(/^(Set up your workspace|Your workspace)$/)
    }
  })

  test('the setup hub lists the five workspace assets', async () => {
    await page.goto('/admin/ops/setup')
    await expect(page.getByRole('heading', { level: 1 }).first()).not.toBeEmpty()
    for (const title of ['Workspace', 'Brand voice', 'Audiences', 'Positioning', 'Evidence bank']) {
      await expect(page.locator('.datum-setup__title', { hasText: title }).first()).toBeVisible()
    }
  })

  test('each setup editor renders', async () => {
    for (const [path, heading] of [
      ['/admin/ops/setup/workspace', 'Workspace'],
      ['/admin/ops/setup/audiences', 'Audiences'],
      ['/admin/ops/setup/positioning', 'Positioning'],
      ['/admin/ops/setup/evidence', 'Evidence bank'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading }).first()).toBeVisible()
    }
  })

  test('can navigate to list view', async () => {
    await page.goto('/admin/collections/users')
    await expect(page).toHaveURL(/\/admin\/collections\/users$/)
    const listViewArtifact = page.locator('h1', { hasText: 'Users' }).first()
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async () => {
    await page.goto('/admin/collections/users/create')
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
