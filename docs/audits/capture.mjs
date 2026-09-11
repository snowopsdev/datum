// Capture every audited route at desktop and mobile widths.
// Usage (repo root, dev server on :3000, PAYLOAD_AUTO_LOGIN=true): DESKTOP_W=1600 node docs/audits/capture.mjs [outDir] [routesFilter]
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const base = 'http://localhost:3000'
const outDir = process.argv[2] || 'docs/audits/screens'
const filter = process.argv[3] || ''
fs.mkdirSync(outDir, { recursive: true })

const routes = [
  ['01-admin-landing', '/admin'],
  ['02-setup', '/admin/ops/setup'],
  ['02-setup-workspace', '/admin/ops/setup/workspace'],
  ['02-setup-audiences', '/admin/ops/setup/audiences'],
  ['02-setup-audience-new', '/admin/ops/setup/audiences/new'],
  ['02-setup-positioning', '/admin/ops/setup/positioning'],
  ['02-setup-evidence', '/admin/ops/setup/evidence'],
  ['03-brand-voice', '/admin/ops/governance/brand-voice'],
  ['04-global-models', '/admin/globals/llm-settings'],
  ['04-global-scoring-policy', '/admin/globals/information-gain-policy'],
  ['04-global-webhooks', '/admin/globals/webhook-settings'],
  ['05-global-workspace-profile', '/admin/globals/workspace-profile'],
  ['05-global-positioning', '/admin/globals/positioning'],
  ['05-global-evidence-bank', '/admin/globals/evidence-bank'],
  ['06-new-content', '/admin/ops/new'],
  ['07-content-list', '/admin/ops/content'],
  ['10-source-review', '/admin/ops/governance/source-review'],
  ['10-sources', '/admin/collections/evidence-sources'],
  ['11-templates', '/admin/ops/templates'],
  ['12-reports-week', '/admin/ops/reports?period=week'],
  ['12-reports-all', '/admin/ops/reports?period=all'],
  ['13-collections-articles', '/admin/collections/articles'],
  ['13-collections-pipeline-runs', '/admin/collections/pipeline-runs'],
  ['14-redirect-topics', '/admin/ops/topics'],
  ['14-redirect-articles', '/admin/ops/articles'],
  ['15-public-home', '/'],
]

const extra = JSON.parse(process.env.EXTRA_ROUTES || '[]')
const all = [...routes, ...extra].filter(([n]) => !filter || n.includes(filter))

const viewports = [
  ['desktop', { width: Number(process.env.DESKTOP_W || 1440), height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]

const browser = await chromium.launch()
const results = []
for (const [vpName, viewport] of viewports) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  // Warm auto-login cookie.
  await page.goto(base + '/admin', { waitUntil: 'networkidle' })
  for (const [name, route] of all) {
    const errsBefore = consoleErrors.length
    const t0 = Date.now()
    let status = 0
    try {
      const resp = await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60000 })
      status = resp?.status() ?? 0
      await page.waitForTimeout(500)
    } catch (e) {
      results.push({ name, route, vp: vpName, error: String(e).slice(0, 120) })
      continue
    }
    const finalUrl = page.url().replace(base, '')
    const file = path.join(outDir, `${name}--${vpName}.png`)
    await page.screenshot({ path: file, fullPage: true })
    const title = await page.title()
    const h1 = await page.locator('h1').first().textContent().catch(() => null)
    const bodyScrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    results.push({
      name, route, vp: vpName, status, finalUrl, title, h1: h1?.trim() ?? null,
      ms: Date.now() - t0,
      hOverflow: bodyScrollW > viewport.width,
      consoleErrors: consoleErrors.slice(errsBefore).slice(0, 3),
    })
  }
  await context.close()
}
await browser.close()
fs.writeFileSync(path.join(outDir, '..', 'capture-log.json'), JSON.stringify(results, null, 2))
for (const r of results) {
  console.log([r.vp, r.name, r.status, r.finalUrl ?? r.error, r.h1 ?? '', r.ms ? r.ms + 'ms' : '', r.hOverflow ? 'H-OVERFLOW' : '', r.consoleErrors?.length ? `errs=${r.consoleErrors.length}` : ''].join(' | '))
}
