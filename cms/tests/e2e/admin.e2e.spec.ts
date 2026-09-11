import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { loadWorkspaceSetup } from '../../src/lib/loadWorkspaceReadiness'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

test.describe('Admin Panel', () => {
  let page: Page
  let dashboardPath: '/admin' | '/admin/ops/content'
  let originalViewport: { height: number; width: number } | null = null

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
    originalViewport = page.viewportSize()

    await login({ dashboardPath, page, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  // Two tests widen the shared page to exercise Payload's nav breakpoint. Put
  // the context's own size back so nothing after them runs at 1440px.
  test.afterEach(async () => {
    const current = page.viewportSize()
    if (originalViewport && (current?.width !== originalViewport.width || current?.height !== originalViewport.height)) {
      await page.setViewportSize(originalViewport)
    }
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

  test('the setup hub lists the seven workspace assets', async () => {
    await page.goto('/admin/ops/setup')
    await expect(page.getByRole('heading', { level: 1 }).first()).not.toBeEmpty()
    for (const title of [
      'Workspace',
      'Brand voice',
      'Audiences',
      'Templates',
      'Positioning',
      'Evidence bank',
      'Models',
    ]) {
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

  test('the curated nav is the only nav, in five groups, and reaches the webhooks', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin')
    const nav = page.locator('.datum-ops-nav')
    await expect(nav).toBeVisible()
    await expect(nav.locator('.datum-ops-nav__label')).toHaveText([
      'Content',
      'Setup',
      'Governance',
      'Settings',
      'Records',
    ])
    await expect(nav.getByRole('link', { name: 'Webhooks' })).toHaveAttribute(
      'href',
      '/admin/globals/webhook-settings',
    )
    // Payload's own entity list is off (every entity sets `admin.group: false`),
    // so nothing outside the curated list may appear in the sidebar.
    await expect(page.locator('.nav__link')).toHaveCount(0)
  })

  test('the nav stays open on a 1440px desktop', async () => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin')
    // Payload closes its nav on anything 1440px or narrower and only restores
    // the saved preference above that; NavOpener puts it back.
    await expect(page.locator('aside.nav')).toHaveClass(/nav--nav-open/)
    await expect(page.locator('.datum-ops-nav')).toBeVisible()
  })

  test('a nav close below 1440px is remembered across a reload', async () => {
    // Payload's own toggler only persists the preference above 1440px, so
    // without NavOpener writing it a close here is forgotten on every load.
    await page.setViewportSize({ width: 1400, height: 900 })
    await page.goto('/admin/ops/content')
    const aside = page.locator('aside.nav')
    const toggler = page.locator('.template-default__nav-toggler').first()
    const settle = () => page.waitForTimeout(1000)

    await expect(aside).toHaveClass(/nav--nav-open/)
    await toggler.click()
    await expect(aside).not.toHaveClass(/nav--nav-open/)
    await settle()
    await page.reload()
    await expect(aside).toHaveClass(/nav--nav-hydrated/)
    await settle()
    await expect(aside).not.toHaveClass(/nav--nav-open/)

    // Reopening is remembered too — the operator is never stuck with either.
    await toggler.click()
    await expect(aside).toHaveClass(/nav--nav-open/)
    await settle()
    await page.reload()
    await expect(aside).toHaveClass(/nav--nav-open/)
  })

  test('brand voice lives beside the other setup assets', async () => {
    await page.goto('/admin/ops/setup/brand-voice')
    expect(new URL(page.url()).pathname).toBe('/admin/ops/setup/brand-voice')
    await expect(page.getByRole('heading', { level: 1, name: 'Brand voice' }).first()).toBeVisible()
  })

  test('the globals shadowed by an ops editor are not reachable as raw forms', async () => {
    for (const slug of ['workspace-profile', 'positioning', 'evidence-bank']) {
      const response = await page.goto(`/admin/globals/${slug}`)
      // The edit view is `<main class="collection-edit global-edit--<slug>">`
      // wrapping `<form class="collection-edit__form">`; neither may exist.
      await expect(page.locator(`main.global-edit--${slug}`)).toHaveCount(0)
      await expect(page.locator('form.collection-edit__form')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
      // Payload answers a hidden entity's admin route with its own not-found
      // view at HTTP 200 rather than 404. Accept either, but insist the page
      // actually says so instead of rendering something else empty-handed.
      if (response?.status() !== 404) {
        await expect(
          page.locator('.not-found').getByRole('heading', { name: 'Nothing found' }),
        ).toBeVisible()
      }
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
