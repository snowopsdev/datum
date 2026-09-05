import { writeFileSync } from 'node:fs'
const base = process.argv[2] || process.env.TEST_BASE_URL
const outputPath = process.argv[3]
const adminPassword = process.env.SEED_ADMIN_PASSWORD
if (!base || !outputPath || !adminPassword) {
  throw new Error('usage: SEED_ADMIN_PASSWORD=... node lane09-http-harness.mjs BASE_URL OUTPUT_PATH')
}
const results = []
async function request(path, init = {}, expected) {
  const response = await fetch(base + path, { ...init, signal: AbortSignal.timeout(180000) })
  const body = await response.json()
  results.push({ path, method: init.method || 'GET', status: response.status, expected, passed: response.status === expected })
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`)
  return body
}
const json = { 'content-type': 'application/json' }
try {
  const anon = await request('/api/users/me', {}, 200)
  if (anon.user !== null) throw new Error('Anonymous session acquired a user')
  for (const collection of ['users', 'articles', 'templates', 'brand-voice-files', 'cost-log', 'article-audit', 'pipeline-runs', 'information-gain-runs']) {
    await request(`/api/${collection}?limit=1`, {}, 403)
  }
  for (const slug of ['webhook-settings', 'workspace-profile', 'evidence-bank', 'llm-settings']) {
    await request(`/api/globals/${slug}`, {}, 403)
  }
  await request('/api/media?limit=1', {}, 200)
  await request('/api/users/login', { method: 'POST', headers: json, body: JSON.stringify({ email: 'admin@datum.local', password: 'incorrect-qa-fixture' }) }, 401)
  const login = await request('/api/users/login', { method: 'POST', headers: json, body: JSON.stringify({ email: 'admin@datum.local', password: adminPassword }) }, 200)
  const headers = { ...json, authorization: `JWT ${login.token}` }
  const user = await request('/api/users/me', { headers }, 200)
  if (!user.user || ['hash', 'salt', 'password'].some(key => key in user.user)) throw new Error('Session privacy assertion failed')
  await request('/api/articles?limit=1', { headers }, 200)
  const invalid = await request('/api/users/me', { headers: { authorization: `JWT ${login.token.slice(0, -5)}wrong` } }, 200)
  if (invalid.user !== null) throw new Error('Invalid token acquired a user')
  for (const collection of ['cost-log', 'article-audit', 'governance-audit', 'information-gain-runs', 'pipeline-runs']) {
    await request(`/api/${collection}`, { method: 'POST', headers, body: '{}' }, 403)
  }
  const graph = await request('/api/graphql', { method: 'POST', headers: json, body: JSON.stringify({ query: '{ Users { docs { id email } } }' }) }, 200)
  if (graph.data?.Users?.docs?.length) throw new Error('GraphQL leaked users')
  const authenticatedGraph = await request('/api/graphql', { method: 'POST', headers, body: JSON.stringify({ query: '{ Users { docs { id email } } }' }) }, 200)
  if (!authenticatedGraph.data?.Users?.docs?.length) throw new Error('Authenticated GraphQL missing users')
  await request('/api/users/logout', { method: 'POST', headers }, 200)
  const loggedOut = await request('/api/users/me', { headers }, 200)
  if (loggedOut.user !== null) throw new Error('Logged-out session token remained usable')
} finally {
  writeFileSync(outputPath, JSON.stringify(results, null, 2))
}
console.log(JSON.stringify(results))
