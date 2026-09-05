import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface LoginOptions {
  dashboardPath?: '/admin' | '/admin/ops/content'
  page: Page
  serverURL?: string
  user: {
    email: string
    password: string
  }
}

/**
 * Logs the user into the admin panel via the login page.
 */
export async function login({
  dashboardPath = '/admin',
  page,
  serverURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101',
  user,
}: LoginOptions): Promise<void> {
  await page.goto(`${serverURL}/admin/login`)

  await page.fill('#field-email', user.email)
  await page.fill('#field-password', user.password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${serverURL}${dashboardPath}`)

  const dashboardArtifact = page.locator('span[title="Dashboard"]')
  await expect(dashboardArtifact).toBeVisible()
}
