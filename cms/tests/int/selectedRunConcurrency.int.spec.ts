import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type TypedUser } from 'payload'
import { expect, it } from 'vitest'

it('queues both selected runs when editors launch work concurrently', async () => {
  const payload = await getPayload({ config: await config })
  const template = await payload.create({
    collection: 'templates', overrideAccess: true,
    data: { name: `QA selected concurrency ${randomUUID()}` },
  })
  const runIds = [randomUUID(), randomUUID()]
  const article = await payload.create({
    collection: 'articles', overrideAccess: true,
    data: { keyword: `QA selected ${randomUUID()}`, template: template.id, status: 'topic_selected' },
  })
  const readiness = evaluateWorkspaceReadiness({
    env: { MOCK_MODE: 'true' }, models: null,
    activeVoice: { id: 1, updatedAt: new Date(0).toISOString() },
    templates: [{ id: template.id, name: template.name, updatedAt: template.updatedAt }],
    verification: null,
    profile: resolveWorkspaceProfile(null, {}, { mockDefault: true }),
    icps: [{ id: 5, updatedAt: new Date(0).toISOString(), name: 'Demo', primary: true }],
    positioning: { content: null, updatedAt: null },
    evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-05' },
  })
  try {
    const results = await Promise.allSettled(runIds.map((runId) => createPipelineRun(
      payload,
      { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser,
      { source: 'selected', templateId: template.id, count: 1, runId,
        articleIds: [article.id], requestedBy: 'admin@datum.local', readiness },
    )))
    for (const result of results) {
      if (result.status === 'rejected') {
        const cause = result.reason?.cause
        console.log('selected launch error', { name: result.reason?.name,
          databaseCode: cause?.code, databaseMessage: cause?.message })
      }
    }
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled'])
    const runs = await payload.find({ collection: 'pipeline-runs', overrideAccess: true,
      where: { runId: { in: runIds } }, pagination: false })
    const jobs = await payload.find({ collection: 'payload-jobs', overrideAccess: true,
      where: { 'input.runId': { in: runIds } }, pagination: false })
    expect(runs.docs).toHaveLength(2)
    expect(jobs.docs).toHaveLength(2)
  } finally {
    await payload.delete({ collection: 'payload-jobs', overrideAccess: true,
      where: { 'input.runId': { in: runIds } } })
    await payload.delete({ collection: 'pipeline-runs', overrideAccess: true,
      where: { runId: { in: runIds } } })
    // The article's append-only audit record retains its relationship. Keep
    // the article and template, as the other database-backed suites do.
  }
})
