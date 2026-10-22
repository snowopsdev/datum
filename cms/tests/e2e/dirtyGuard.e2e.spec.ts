import { expect, test, type Page } from '@playwright/test'

import { evidenceBankFixtureDoc } from '../../src/lib/tenant/fixtures'
import { cleanupOpsUser, opsPayload, opsTestUser, seedOpsUser } from '../helpers/seedContentOps'

const serverURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3101'

/**
 * F5: the unsaved-change guard on the editors that were silently losing edits.
 * Mock mode. Each test restores what it saves, so the specs that follow find the
 * seeded workspace as they expect.
 */
test.describe('Unsaved-change guard', () => {
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
    // A form left dirty at the end of a test would hold the next navigation
    // behind the browser's own prompt.
    page.on('dialog', (dialog) => void dialog.accept())
  })

  const dirtyText = (page: Page) => page.locator('.datum-ops__dirty')
  const bar = (page: Page) => page.locator('[data-unsaved-bar]')
  const outline = (page: Page) => page.locator('#outline')
  const nav = (page: Page) => page.locator('a[href="/admin/ops/content"]').first()

  async function openTemplates(page: Page) {
    await page.goto(`${serverURL}/admin/ops/templates`)
    await expect(outline(page)).toBeVisible()
    // Hydrated: the Save button is a real button and starts disabled.
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  }

  test('templates: an edit shows the dot, the count and the bar, and Save is honest about it', async ({
    page,
  }) => {
    await openTemplates(page)
    await expect(dirtyText(page)).toHaveText('')
    await expect(bar(page)).toHaveCount(0)

    const before = await outline(page).inputValue()
    await outline(page).fill(`${before} edited`)
    await expect(dirtyText(page)).toHaveText('1 unsaved change')
    await expect(bar(page)).toBeVisible()
    await expect(bar(page).getByRole('button', { name: 'Discard' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()

    // Typing it back is no change at all.
    await outline(page).fill(before)
    await expect(dirtyText(page)).toHaveText('')
    await expect(bar(page)).toHaveCount(0)

    await outline(page).fill(`${before} edited`)
    await bar(page).getByRole('button', { name: 'Discard' }).click()
    await expect(outline(page)).toHaveValue(before)
    await expect(bar(page)).toHaveCount(0)
  })

  test('templates: leaving by a nav link asks first; Stay keeps the edit and the focus', async ({
    page,
  }) => {
    await openTemplates(page)
    const before = await outline(page).inputValue()
    await outline(page).fill(`${before} kept`)
    await expect(dirtyText(page)).toHaveText('1 unsaved change')

    const link = nav(page)
    await link.focus()
    await link.click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('the outline')
    await expect(dialog).toContainText('local copy for 24 hours')
    await expect(dialog.getByRole('button', { name: 'Stay' })).toBeFocused()

    // Tab wraps inside the dialog rather than reaching the page behind it.
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Save and leave' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Stay' })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/admin\/ops\/templates/)
    await expect(outline(page)).toHaveValue(`${before} kept`)
    await expect(link).toBeFocused()
  })

  test('templates: Leave navigates away, and the edit is waiting when you come back', async ({
    page,
  }) => {
    await openTemplates(page)
    const before = await outline(page).inputValue()
    await outline(page).fill(`${before} left behind`)
    await nav(page).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/ops\/content/)

    await page.goto(`${serverURL}/admin/ops/templates`)
    await expect(page.getByText(/Restored the edit you hadn't saved, from \d+ minutes? ago/)).toBeVisible()
    await expect(outline(page)).toHaveValue(`${before} left behind`)
    await page.getByRole('button', { name: 'Discard' }).first().click()
    await expect(outline(page)).toHaveValue(before)
    await expect(page.getByText(/Restored the edit/)).toHaveCount(0)
  })

  test('templates: Save and leave saves, then navigates', async ({ page }) => {
    await openTemplates(page)
    const before = await outline(page).inputValue()
    try {
      await outline(page).fill(`${before} saved on the way out`)
      await nav(page).click()
      await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Save and leave' })
        .click()
      await expect(page).toHaveURL(/\/admin\/ops\/content/)

      await page.goto(`${serverURL}/admin/ops/templates`)
      await expect(outline(page)).toHaveValue(`${before} saved on the way out`)
      // Saved for real, so there is nothing to restore.
      await expect(page.getByText(/Restored the edit/)).toHaveCount(0)
    } finally {
      await outline(page).fill(before)
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('button', { name: /^Saved ·/ })).toBeVisible()
    }
  })

  test('templates: switching template while dirty asks instead of resetting', async ({ page }) => {
    await openTemplates(page)
    const picks = page.locator('.datum-ops__tpl-list > button').filter({ hasNotText: 'New template' })
    expect(await picks.count()).toBeGreaterThan(1)
    const before = await outline(page).inputValue()
    await outline(page).fill(`${before} mid-edit`)

    await picks.nth(1).click()
    const dialog = page.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Stay' }).click()
    await expect(outline(page)).toHaveValue(`${before} mid-edit`)

    await picks.nth(1).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Leave', exact: true }).click()
    await expect(page).toHaveURL(/templates\?id=/)
    await expect(outline(page)).not.toHaveValue(`${before} mid-edit`)
    await expect(dirtyText(page)).toHaveText('')
  })

  test('evidence: an edit survives a reload as a restore banner you can discard', async ({
    page,
  }) => {
    // The seeded database has an empty bank; give it the demo one, then put it back.
    const payload = await opsPayload()
    const original = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, never>
    await payload.updateGlobal({
      slug: 'evidence-bank',
      data: evidenceBankFixtureDoc() as never,
      overrideAccess: true,
    })
    try {
      await evidenceRestore(page)
    } finally {
      await payload.updateGlobal({
        slug: 'evidence-bank',
        data: {
          verifiedClaims: original.verifiedClaims ?? [],
          facts: original.facts ?? [],
          rejectedClaims: original.rejectedClaims ?? [],
        },
        overrideAccess: true,
      })
    }
  })

  async function evidenceRestore(page: Page) {
    await page.goto(`${serverURL}/admin/ops/setup/evidence`)
    const claim = page.locator('#eb-claims-0-claim')
    await expect(claim).toBeVisible()
    const before = await claim.inputValue()
    await claim.fill(`${before} (draft)`)
    await expect(dirtyText(page)).toHaveText('1 unsaved change')
    // The mirror is debounced; give it a moment before leaving.
    await page.waitForTimeout(900)

    await page.reload()
    await expect(page.getByText(/Restored the edit you hadn't saved, from \d+ minutes? ago/)).toBeVisible()
    await expect(page.locator('#eb-claims-0-claim')).toHaveValue(`${before} (draft)`)
    await expect(dirtyText(page)).toHaveText('1 unsaved change')

    await page.getByRole('button', { name: 'Discard' }).first().click()
    await expect(page.locator('#eb-claims-0-claim')).toHaveValue(before)
    await expect(page.getByText(/Restored the edit/)).toHaveCount(0)

    await page.reload()
    await expect(page.locator('#eb-claims-0-claim')).toHaveValue(before)
    await expect(page.getByText(/Restored the edit/)).toHaveCount(0)
  }

  test('workspace: saving with an invalid competitor says what was kept and what was removed', async ({
    page,
  }) => {
    await page.goto(`${serverURL}/admin/ops/setup/workspace`)
    await expect(page.getByRole('heading', { name: 'Workspace', level: 1 })).toBeVisible()
    const original = await page.locator('#ws-companyName').inputValue()
    try {
      await page.getByRole('button', { name: /Who you write against/ }).click()
      const known = await page.locator('[id^="ws-competitors-"][id$="-domain"]').count()
      await page.getByRole('button', { name: 'Add a competitor' }).click()
      await page.locator(`#ws-competitors-${known}-domain`).fill('not a domain')
      await page.getByRole('button', { name: 'Add a competitor' }).click()
      await page.locator(`#ws-competitors-${known + 1}-domain`).fill('Kept-Competitor.com')
      await expect(dirtyText(page)).toHaveText('1 unsaved change')

      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(
        page.getByText(new RegExp(`Saved · ${known + 1} competitors? kept, 1 invalid removed`)),
      ).toBeVisible()
      // The form shows what was stored: the invalid row is gone, not still sitting there.
      await expect(page.locator('[id^="ws-competitors-"][id$="-domain"]')).toHaveCount(known + 1)
      await expect(page.locator('[id^="ws-competitors-"][id$="-domain"]').last()).toHaveValue(
        'kept-competitor.com',
      )
      await expect(dirtyText(page)).toHaveText('')
    } finally {
      // Put the competitors back to what they were.
      const rows = page.locator('[id^="ws-competitors-"][id$="-domain"]')
      if ((await rows.count()) > 0 && (await rows.last().inputValue()) === 'kept-competitor.com') {
        await page.getByRole('button', { name: 'Remove' }).last().click()
        await page.getByRole('button', { name: 'Save', exact: true }).click()
        await expect(page.getByRole('button', { name: /^Saved ·/ })).toBeVisible()
      }
      expect(original).toBeDefined()
    }
  })
})
