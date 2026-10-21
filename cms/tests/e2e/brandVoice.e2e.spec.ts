import { expect, test, type Page } from '@playwright/test'
import type { Payload } from 'payload'

import { login } from '../helpers/login'
import {
  cleanupOpsUser,
  ensureRunReadiness,
  opsPayload,
  opsTestUser,
  seedOpsUser,
} from '../helpers/seedContentOps'

/**
 * Archiving the active voice takes two clicks, and Escape backs out. This stops
 * short of the archive itself: the e2e database is shared, and an archived
 * voice would refuse every run spec that comes after this one.
 */
test.describe('Brand voice archive', () => {
  let page: Page
  let payload: Payload

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    payload = await opsPayload()
    await seedOpsUser(payload)
    await ensureRunReadiness(payload)

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ page, user: opsTestUser })
  })

  test.afterAll(async () => {
    await page.context().close()
    await cleanupOpsUser(payload)
  })

  test('archiving the active voice is armed first, and Escape leaves it active', async () => {
    await page.goto('/admin/ops/setup/brand-voice')

    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Confirm: archive' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Confirm: archive' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible()
  })
})
