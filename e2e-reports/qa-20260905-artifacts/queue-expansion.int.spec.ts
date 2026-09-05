import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type TypedUser } from 'payload'
import { expect, it } from 'vitest'

it('expansion3 checks mixed queue sources, duplicate IDs, and rollback recovery', async () => {
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
    const launch = (runId: string, source: 'selected' | 'admin' = 'selected') => createPipelineRun(
      payload, { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser,
      { source, templateId: template.id, count: 1, runId, articleIds: [article.id],
        requestedBy: 'admin@datum.local', readiness })
    // Pairwise: an admin discovery run already queued does not reject a selected run.
    await launch(runIds[0], 'admin')
    await launch(runIds[1])
    const countRuns = async () => (await payload.find({ collection: 'pipeline-runs',
      where: { runId: { in: runIds } }, overrideAccess: true, pagination: false })).docs.length
    const countJobs = async () => (await payload.find({ collection: 'payload-jobs',
      where: { 'input.runId': { in: runIds } }, overrideAccess: true, pagination: false })).docs.length
    expect(await countRuns()).toBe(2)
    expect(await countJobs()).toBe(2)
    // Boundary: replaying a unique run ID neither duplicates the run nor leaks a job.
    await expect(launch(runIds[1])).rejects.toThrow()
    expect(await countRuns()).toBe(2)
    expect(await countJobs()).toBe(2)
    // History: an enqueue fault rolls back its run, and the same ID can then retry.
    const retryId = randomUUID()
    runIds.push(retryId)
    const queue = payload.jobs.queue
    payload.jobs.queue = async () => { throw new Error('QA simulated queue failure') }
    try { await expect(launch(retryId)).rejects.toThrow('QA simulated queue failure') }
    finally { payload.jobs.queue = queue }
    expect(await countRuns()).toBe(2)
    expect(await countJobs()).toBe(2)
    await launch(retryId)
    expect(await countRuns()).toBe(3)
    expect(await countJobs()).toBe(3)
  } finally {
    await payload.delete({ collection: 'payload-jobs', overrideAccess: true,
      where: { 'input.runId': { in: runIds } } })
    await payload.delete({ collection: 'pipeline-runs', overrideAccess: true,
      where: { runId: { in: runIds } } })
    // The article's append-only audit record retains its relationship. Keep
    // the article and template, as the other database-backed suites do.
  }
})
