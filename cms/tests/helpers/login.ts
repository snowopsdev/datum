import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  dashboardPath?: '/admin' | '/admin/ops/content'
  page: Page
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 *
 * Paths are relative so Playwright resolves them against the configured
 * `baseURL`, which is the one place that knows `TEST_BASE_URL` and `TEST_PORT`.
 */
export async function login({ dashboardPath = '/admin', page, user }: LoginOptions): Promise<void> {
  await page.goto('/admin/login')

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(dashboardPath)

  const dashboardArtifact = page.locator('span[title="Dashboard"]')
  await expect(dashboardArtifact).toBeVisible()
}
