import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import config from '@/payload.config'
import { createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type TypedUser } from 'payload'
import { expect, it } from 'vitest'

it('runs bounded workflow launch stress', async () => {
  const payload = await getPayload({ config: await config })
  const template = await payload.create({
    collection: 'templates', overrideAccess: true,
    data: { name: `QA selected concurrency ${randomUUID()}` },
  })
  const runIds: string[] = []
  const latencies: number[] = []
  const errors: string[] = []
  const start = performance.now()
  let peakInFlight = 0
  let inFlight = 0
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
    for (const concurrency of [1, 2, 5, 10, 20]) {
      if (performance.now() - start > 300_000 || runIds.length + concurrency > 500) break
      const batch = Array.from({ length: concurrency }, () => randomUUID())
      runIds.push(...batch)
      await Promise.all(batch.map(async (runId) => {
        const began = performance.now()
        inFlight += 1
        peakInFlight = Math.max(peakInFlight, inFlight)
        try {
          await createPipelineRun(payload,
            { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser,
            { source: 'selected', templateId: template.id, count: 1, runId,
              articleIds: [article.id], requestedBy: 'admin@datum.local', readiness })
        } catch (error) {
          errors.push(String((error as { cause?: { code?: string } }).cause?.code ?? 'unknown'))
        } finally {
          latencies.push(performance.now() - began)
          inFlight -= 1
        }
      }))
      if (errors.length) break
    }
    const elapsed = performance.now() - start
    const runs = await payload.find({ collection: 'pipeline-runs', overrideAccess: true,
      where: { runId: { in: runIds } }, pagination: false })
    const jobs = await payload.find({ collection: 'payload-jobs', overrideAccess: true,
      where: { 'input.runId': { in: runIds } }, pagination: false })
    latencies.sort((a, b) => a - b)
    const percentile = (p: number) => latencies[Math.ceil(latencies.length * p) - 1]
    const metrics = {
      operations: runIds.length, durationMs: elapsed, throughput: runIds.length / (elapsed / 1000),
      p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), n: latencies.length,
      errors, peakInFlight, memoryRssBytes: process.memoryUsage().rss,
      integrity: { runs: runs.docs.length, jobs: jobs.docs.length },
      stop: errors.length ? 'error' : 'matrix completed',
    }
    if (process.env.QA_STRESS_OUTPUT) writeFileSync(process.env.QA_STRESS_OUTPUT, JSON.stringify(metrics, null, 2))
    expect(errors).toEqual([])
    expect(runs.docs).toHaveLength(runIds.length)
    expect(jobs.docs).toHaveLength(runIds.length)
  } finally {
    await payload.delete({ collection: 'payload-jobs', overrideAccess: true,
      where: { 'input.runId': { in: runIds } } })
    await payload.delete({ collection: 'pipeline-runs', overrideAccess: true,
      where: { runId: { in: runIds } } })
    // The article's append-only audit record retains its relationship. Keep
    // the article and template, as the other database-backed suites do.
  }
})
