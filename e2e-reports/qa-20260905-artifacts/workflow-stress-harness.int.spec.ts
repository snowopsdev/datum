import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'

import config from '@/payload.config'
import { createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type TypedUser } from 'payload'
import { expect, it } from 'vitest'

const TEST_TIMEOUT_MS = 300_000
const DRAIN_GRACE_MS = 10_000
const EXIT_MARGIN_MS = 5_000
const LAUNCH_DEADLINE_MS = TEST_TIMEOUT_MS - DRAIN_GRACE_MS - EXIT_MARGIN_MS
const CONCURRENCY_RAMPS = [1, 2, 5, 10, 20]
const EXPECTED_OPERATIONS = CONCURRENCY_RAMPS.reduce(
  (sum, concurrency) => sum + concurrency,
  0,
)

async function settlesWithin<T>(work: Promise<T>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work.then(() => true, () => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function beforeDeadline<T>(work: Promise<T>, deadlineAt: number): Promise<T> {
  const remainingMs = deadlineAt - performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const outcome = remainingMs <= 0
      ? { kind: 'deadline' as const }
      : await Promise.race([
          work.then((value) => ({ kind: 'completed' as const, value })),
          new Promise<{ kind: 'deadline' }>((resolve) => {
            timer = setTimeout(
              () => resolve({ kind: 'deadline' }),
              Math.ceil(remainingMs),
            )
          }),
        ])
    if (outcome.kind === 'deadline') {
      if (timer) clearTimeout(timer)
      // createPipelineRun has no cancellation signal. Drain for a bounded
      // grace period. This harness never deletes its uniquely identified rows,
      // so work that remains pending cannot race cleanup in the isolated DB.
      const drained = await settlesWithin(work, DRAIN_GRACE_MS)
      throw new Error(drained
        ? 'Workflow stress deadline exceeded after draining active launches'
        : 'Workflow stress deadline exceeded; active launches retained in isolated database')
    }
    return outcome.value
  } finally {
    if (timer) clearTimeout(timer)
  }
}

it('runs bounded workflow launch stress', async () => {
  const deadlineAt = performance.now() + LAUNCH_DEADLINE_MS
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
    for (const concurrency of CONCURRENCY_RAMPS) {
      if (performance.now() >= deadlineAt) throw new Error('Workflow stress deadline exceeded')
      if (runIds.length + concurrency > 500) throw new Error('Workflow stress operation limit exceeded')
      const batch = Array.from({ length: concurrency }, () => randomUUID())
      runIds.push(...batch)
      await beforeDeadline(Promise.all(batch.map(async (runId) => {
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
      })), deadlineAt)
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
    expect(runIds).toHaveLength(EXPECTED_OPERATIONS)
    expect(runs.docs).toHaveLength(runIds.length)
    expect(jobs.docs).toHaveLength(runIds.length)
  } finally {
    // Retain this harness's uniquely identified run, job, article, and template
    // rows as evidence in the dedicated isolated database. Discard that test
    // database after inspection instead of racing uncancellable Payload calls.
  }
}, TEST_TIMEOUT_MS)
