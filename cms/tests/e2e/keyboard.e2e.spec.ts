import { test, expect } from '@playwright/test'

import { cleanupOpsUser, opsPayload, opsTestUser, seedOpsUser } from '../helpers/seedContentOps'

const serverURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101'

test.describe('Keyboard access: skip link and focus ring', () => {
  test.beforeAll(async () => {
    await seedOpsUser(await opsPayload())
  })

  test.afterAll(async () => {
    await cleanupOpsUser(await opsPayload())
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`${serverURL}/admin/login`)
    await page.fill('#field-email', opsTestUser.email)
    await page.fill('#field-password', opsTestUser.password)
    await page.click('button[type="submit"]')
    await page.waitForURL((url) => !url.pathname.endsWith('/login'))
  })

  test('first Tab lands on "Skip to content", which moves focus to #ops-main', async ({ page }) => {
    await page.goto(`${serverURL}/admin/ops/content`)
    await expect(page.locator('#ops-main')).toBeVisible()
    // The link mounts after hydration; wait for it before pressing Tab.
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeAttached()

    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()

    await page.keyboard.press('Enter')
    await expect(page.locator('#ops-main')).toBeFocused()

    // The next Tab goes to the first control inside the view, not back to the nav.
    await page.keyboard.press('Tab')
    const inside = await page.evaluate(
      () => document.getElementById('ops-main')?.contains(document.activeElement) ?? false,
    )
    expect(inside).toBe(true)
  })

  test('skip link is off screen until focused', async ({ page }) => {
    await page.goto(`${serverURL}/admin/ops/content`)
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeAttached()
    await expect(skip).not.toBeInViewport()
  })

  test('skip link falls back to the template content on non-ops pages', async ({ page }) => {
    await page.goto(`${serverURL}/admin/collections/templates`)
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeAttached()
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    const landed = await page.evaluate(
      () =>
        document.activeElement?.classList.contains('template-default__wrap') ||
        document.activeElement?.tagName === 'MAIN',
    )
    expect(landed).toBe(true)
  })

  test('a keyboard-focused ops link and button show the focus ring', async ({ page }) => {
    await page.goto(`${serverURL}/admin/ops/content`)
    await expect(page.locator('#ops-main')).toBeVisible()
    const link = page.locator('#ops-main a').first()
    await link.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(link).toBeFocused()
    const shadow = await link.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).not.toBe('none')

    const button = page.locator('#ops-main button').first()
    if (await button.count()) {
      await button.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(button).toBeFocused()
      expect(await button.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    }
  })
})
