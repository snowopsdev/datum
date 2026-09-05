import { createHmac } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const base = process.argv[2] || process.env.TEST_BASE_URL
const outputPath = process.argv[3]
const adminPassword = process.env.SEED_ADMIN_PASSWORD
if (!base || !outputPath || !adminPassword) {
  throw new Error('usage: SEED_ADMIN_PASSWORD=... node lane05-http-harness.mjs BASE_URL OUTPUT_PATH')
}
const results = []
async function request(path, init = {}, expected) {
  const response = await fetch(base + path, { ...init, signal: AbortSignal.timeout(180000) })
  const body = await response.json()
  results.push({ path, method: init.method || 'GET', status: response.status, expected, passed: response.status === expected })
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`)
  return body
}
await request('/api/users/me', {}, 200)
const login = await request('/api/users/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@datum.local', password: adminPassword }) }, 200)
const headers = { 'content-type': 'application/json', authorization: `JWT ${login.token}` }
const secret = 'qa-20260905-webhook-fixture'
try {
  await request('/api/globals/webhook-settings', { method: 'POST', headers, body: JSON.stringify({ enabled: false, url: null, secret }) }, 200)
  for (const [body, timestamp, expected] of [
    [null, String(Date.now()), 400],
    [[], String(Date.now()), 400],
    [{ event: 'article.status_changed', articleId: 1, to: 'published', slug: 42 }, String(Date.now()), 400],
    [{ event: 'article.status_changed', articleId: 1, to: 'published' }, 'NaN', 401],
    [{ event: 'article.status_changed', articleId: 1, to: 'published' }, String(Date.now()), 200],
  ]) {
    const raw = JSON.stringify(body)
    const signature = 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')
    await request('/hooks/revalidate', { method: 'POST', headers: { 'x-datum-signature': signature, 'x-datum-timestamp': timestamp }, body: raw }, expected)
  }
} finally {
  await request('/api/globals/webhook-settings', { method: 'POST', headers, body: JSON.stringify({ enabled: false, url: null, secret: null }) }, 200)
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
}
console.log(JSON.stringify(results))
