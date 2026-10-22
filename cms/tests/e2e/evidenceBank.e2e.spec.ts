import { test, expect, Page } from '@playwright/test'
import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { evidenceBankFixtureDoc } from '../../src/lib/tenant/fixtures'
import { loadWorkspaceSetup } from '../../src/lib/loadWorkspaceReadiness'
import { login } from '../helpers/login'
import { seedTestUser, cleanupTestUser, testUser } from '../helpers/seedUser'

/**
 * The evidence bank editor's honest save state, its needs-re-check filter, and
 * the Propose button. Mock mode: the assistant answers with the demo bank, which
 * is exactly the set of claims this spec seeds, so every proposal is a duplicate.
 */
test.describe('Evidence bank editor', () => {
  let page: Page
  let original: Record<string, unknown>

  const payloadGlobal = async () => ({ payload: await getPayload({ config }) })

  test.beforeAll(async ({ browser }) => {
    await seedTestUser()
    const { payload } = await payloadGlobal()
    original = (await payload.findGlobal({
      slug: 'evidence-bank',
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    const seed = evidenceBankFixtureDoc() as { verifiedClaims: { ref: string; recheckAt: string }[] }
    // E1 is past its re-check date; the rest are current.
    seed.verifiedClaims[0]!.recheckAt = '2020-01-01'
    await payload.updateGlobal({
      slug: 'evidence-bank',
      data: seed as never,
      overrideAccess: true,
    })

    const [setup, articles] = await Promise.all([
      loadWorkspaceSetup(payload),
      payload.count({ collection: 'articles', where: { archived: { not_equals: true } } }),
    ])
    const dashboardPath =
      setup.readiness.governance.ready && articles.totalDocs > 0 ? '/admin/ops/content' : '/admin'

    const context = await browser.newContext()
    page = await context.newPage()
    await login({ dashboardPath, page, user: testUser })
    // A test that ends with an unsaved edit would otherwise hold the next
    // navigation behind the browser's own leave prompt.
    page.on('dialog', (dialog) => void dialog.accept())
  })

  // Each test starts from what is saved. A test that ends with an unsaved edit
  // leaves a local copy (written again as its page unloads), and the next load
  // would restore it. So leave first, then drop the copies.
  test.beforeEach(async () => {
    await page.goto('/admin')
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('datum:draft:')) localStorage.removeItem(key)
      }
    })
  })

  test.afterAll(async () => {
    const { payload } = await payloadGlobal()
    await payload.updateGlobal({
      slug: 'evidence-bank',
      data: {
        verifiedClaims: (original.verifiedClaims as never) ?? [],
        facts: (original.facts as never) ?? [],
        rejectedClaims: (original.rejectedClaims as never) ?? [],
      },
      overrideAccess: true,
    })
    await cleanupTestUser()
  })

  // The dot-and-count beside Save. The bar repeats it for the eye, so a text
  // match would find two; this is the one live region.
  const unsaved = () => page.locator('.datum-ops__dirty')
  const saveButton = () => page.getByRole('button', { name: 'Save', exact: true })

  test('says how many changes are unsaved, and nothing is saveable when none are', async () => {
    await page.goto('/admin/ops/setup/evidence')
    await expect(saveButton()).toBeDisabled()
    await expect(unsaved()).toHaveText('')

    const claim = page.locator('#eb-claims-1-claim')
    const before = await claim.inputValue()
    await claim.fill(`${before} (edited)`)
    await expect(unsaved()).toHaveText('1 unsaved change')
    await expect(saveButton()).toBeEnabled()

    // Typing the original text back is no change at all.
    await claim.fill(before)
    await expect(unsaved()).toHaveText('')
    await expect(saveButton()).toBeDisabled()

    await page.getByRole('button', { name: 'Remove' }).nth(1).click()
    await expect(unsaved()).toHaveText('1 unsaved change')
  })

  test('keeps an edited row visible under the re-check filter, without duplicating it on save', async () => {
    await page.goto('/admin/ops/setup/evidence')
    await page.getByLabel('Only show claims that need a re-check').check()
    await expect(page.locator('#eb-claims-0-claim')).toBeVisible()
    await expect(page.locator('#eb-claims-1-claim')).toHaveCount(0)

    // Moving the date forward would drop the row from the filter. It stays
    // while it holds an unsaved edit.
    await page.locator('#eb-claims-0-recheckAt').fill('2027-06-30')
    await expect(page.locator('#eb-claims-0-claim')).toBeVisible()
    await expect(unsaved()).toHaveText('1 unsaved change')

    await page.getByRole('button', { name: 'Add a claim' }).click()
    await expect(page.locator('#eb-claims-1-claim')).toBeVisible()
    await page.locator('#eb-claims-1-claim').fill('A brand new claim')
    await page.getByLabel('Only show claims that need a re-check').uncheck()
    // 7 seeded claims minus none, plus the new one: no row appears twice.
    const total = await page.locator('[id^="eb-claims-"][id$="-claim"]').count()
    await saveButton().click()
    // The save says what it kept, in a toast, and the button says when.
    await expect(page.getByText(/Saved · \d+ claims/)).toBeVisible()
    await expect(page.locator('[id^="eb-claims-"][id$="-claim"]')).toHaveCount(total)
    await expect(page.getByRole('button', { name: /^Saved ·/ })).toBeDisabled()
    await expect(unsaved()).toHaveText('')
  })

  test('blocks Propose without notes, and leaves out claims the bank already holds', async () => {
    await page.goto('/admin/ops/setup/evidence')
    const propose = page.getByRole('button', { name: 'Propose claims' })
    await expect(propose).toBeDisabled()
    await expect(page.getByText(/Paste some notes first/)).toBeVisible()

    const rows = page.locator('[id^="eb-claims-"][id$="-claim"]')
    const count = await rows.count()
    await page.locator('#eb-assist-notes').fill('Kettle & Burr tested six budget espresso grinders')
    await expect(propose).toBeEnabled()
    await propose.click()
    await expect(page.getByText(/already in your bank/)).toBeVisible()
    await expect(rows).toHaveCount(count)
    await expect(unsaved()).toHaveText('')
  })
})
