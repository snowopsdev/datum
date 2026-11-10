import { randomUUID } from 'node:crypto'
import { sql } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// The handler's workspace inputs and the pipeline itself are faked: these
// tests are about the run row's lease, not about what a stage writes.
vi.mock('../../../pipeline/src/runContext', () => ({
  loadStageInputs: vi.fn().mockResolvedValue({
    tenant: { profile: { targetDomain: 'example.com' }, icps: [{ id: 1, primary: true }] },
    brandVoice: { name: 'Test voice' },
  }),
  buildStageContext: vi.fn().mockReturnValue({}),
}))
vi.mock('../../../pipeline/src/stages', () => ({ runPipeline: vi.fn() }))

import config from '@/payload.config'
import { executeContentRun } from '@/jobs/contentRun'
import { recoverStaleRuns, RUN_LEASE_TIMEOUT_MS } from '@/lib/pipelineRunLease'
import type { PipelineRun } from '@/payload-types'
import { runPipeline } from '../../../pipeline/src/stages'

const runPipelineMock = vi.mocked(runPipeline)

let payload: Payload
let templateId: number
let articleId: number
const runIds: number[] = []
const jobIds: Array<number | string> = []

const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

async function createRun(data: Partial<PipelineRun>): Promise<PipelineRun> {
  const run = await payload.create({
    collection: 'pipeline-runs',
    overrideAccess: true,
    data: {
      runId: randomUUID(),
      source: 'selected',
      status: 'queued',
      mode: 'mock',
      template: templateId,
      requestedCount: 1,
      articles: [articleId],
      requestedBy: 'test',
      configFingerprint: 'test',
      configSnapshot: {},
      ...data,
    },
  })
  runIds.push(run.id)
  return run
}

/** A content-run job the way a worker that died mid-run leaves it: taken, never finished. */
async function stuckJob(runId: string, updatedAt: string) {
  const job = await payload.jobs.queue({
    task: 'content-run',
    // Not `content`: nothing in this suite should ever pick it up.
    queue: 'lease-test',
    input: { runId },
    overrideAccess: true,
  })
  jobIds.push(job.id)
  // Raw SQL: Payload stamps `updatedAt` itself on every update, and the age of
  // the job's last touch is exactly what recovery reads.
  await (
    payload.db as unknown as { drizzle: { execute: (query: unknown) => Promise<unknown> } }
  ).drizzle.execute(
    sql`UPDATE payload_jobs SET processing = true, updated_at = ${updatedAt} WHERE id = ${job.id}`,
  )
  return job.id
}

type Executor = { execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }> }

const readRun = (id: number) =>
  payload.findByID({ collection: 'pipeline-runs', id, depth: 0, overrideAccess: true })
const readJob = (id: number | string) =>
  payload.findByID({ collection: 'payload-jobs', id, depth: 0, overrideAccess: true })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const template = await payload.create({
    collection: 'templates',
    data: { name: `Lease ${randomUUID()}` },
  })
  templateId = template.id
  const article = await payload.create({
    collection: 'articles',
    data: { keyword: `lease ${randomUUID()}`, status: 'topic_selected', template: templateId },
  })
  articleId = article.id
})

beforeEach(() => {
  runPipelineMock.mockReset()
})

afterAll(async () => {
  for (const id of jobIds) {
    await payload.delete({ collection: 'payload-jobs', id, overrideAccess: true })
  }
  for (const id of runIds) {
    await payload.delete({ collection: 'pipeline-runs', id, overrideAccess: true })
  }
  await payload.update({
    collection: 'articles',
    id: articleId,
    data: { archived: true },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'templates', id: templateId, overrideAccess: true })
})

describe('recover-stale-runs', () => {
  it('fails a running run whose heartbeat is stale and releases its stuck job', async () => {
    const run = await createRun({
      status: 'running',
      startedAt: ago(RUN_LEASE_TIMEOUT_MS * 3),
      heartbeatAt: ago(RUN_LEASE_TIMEOUT_MS + 60_000),
    })
    const jobId = await stuckJob(run.runId, ago(RUN_LEASE_TIMEOUT_MS * 3))

    const result = await recoverStaleRuns(payload)

    expect(result.recoveredRuns).toContain(run.runId)
    expect(result.failedJobs).toContain(jobId)
    const recovered = await readRun(run.id)
    expect(recovered.status).toBe('failed')
    expect(recovered.errorSummary).toContain('worker stopped responding')
    expect(recovered.completedAt).toBeTruthy()
    const job = await readJob(jobId)
    // Exactly what Payload's runner needs to stop counting the job as holding
    // the `content-pipeline` key and to never pick it up again.
    expect(job.processing).toBe(false)
    expect(job.hasError).toBe(true)
  })

  it('falls back to startedAt for a run that never wrote a heartbeat', async () => {
    const run = await createRun({ status: 'running', startedAt: ago(RUN_LEASE_TIMEOUT_MS * 2) })
    const result = await recoverStaleRuns(payload)
    expect(result.recoveredRuns).toContain(run.runId)
    expect((await readRun(run.id)).status).toBe('failed')
  })

  it('leaves a long run with a fresh heartbeat alone, and its job too', async () => {
    const run = await createRun({
      status: 'running',
      // Started long ago: elapsed time alone must never release a live run.
      startedAt: ago(RUN_LEASE_TIMEOUT_MS * 10),
      heartbeatAt: ago(30_000),
    })
    const jobId = await stuckJob(run.runId, ago(RUN_LEASE_TIMEOUT_MS * 10))

    const result = await recoverStaleRuns(payload)

    expect(result.recoveredRuns).not.toContain(run.runId)
    expect(result.failedJobs).not.toContain(jobId)
    expect((await readRun(run.id)).status).toBe('running')
    expect((await readJob(jobId)).processing).toBe(true)
    await payload.update({
      collection: 'payload-jobs',
      id: jobId,
      data: { processing: false },
      overrideAccess: true,
    })
  })

  it('releases a job whose worker died before it claimed the run, and fails the queued run', async () => {
    const run = await createRun({ status: 'queued' })
    const jobId = await stuckJob(run.runId, ago(RUN_LEASE_TIMEOUT_MS + 60_000))

    const result = await recoverStaleRuns(payload)

    expect(result.failedJobs).toContain(jobId)
    expect((await readJob(jobId)).hasError).toBe(true)
    const failed = await readRun(run.id)
    expect(failed.status).toBe('failed')
    expect(failed.errorSummary).toContain('stopped responding')
  })

  it('leaves the job alone when its worker claims the queued run while recovery waits', async () => {
    const run = await createRun({ status: 'queued' })
    const jobId = await stuckJob(run.runId, ago(RUN_LEASE_TIMEOUT_MS + 60_000))

    // The worker's claim, holding the row lock and not yet committed when
    // recovery reads the run.
    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) throw new Error('no transaction')
    const session = (payload.db as unknown as { sessions: Record<string, { db: Executor }> })
      .sessions[String(transactionID)].db
    await session.execute(sql`SELECT id FROM pipeline_runs WHERE id = ${run.id} FOR UPDATE`)
    await session.execute(
      sql`UPDATE pipeline_runs SET status = 'running', started_at = now(), heartbeat_at = now() WHERE id = ${run.id}`,
    )
    const recovery = recoverStaleRuns(payload)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await payload.db.commitTransaction(transactionID)
    const result = await recovery

    expect(result.recoveredRuns).not.toContain(run.runId)
    expect(result.failedJobs).not.toContain(jobId)
    expect((await readRun(run.id)).status).toBe('running')
    const job = await readJob(jobId)
    expect(job.processing).toBe(true)
    expect(job.hasError ?? false).toBe(false)

    await payload.update({
      collection: 'payload-jobs',
      id: jobId,
      data: { processing: false },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'pipeline-runs',
      id: run.id,
      data: { status: 'failed' },
      overrideAccess: true,
    })
  })

  it('does not touch a job that was only just taken', async () => {
    const run = await createRun({ status: 'queued' })
    const jobId = await stuckJob(run.runId, ago(5_000))
    const result = await recoverStaleRuns(payload)
    expect(result.failedJobs).not.toContain(jobId)
    expect((await readRun(run.id)).status).toBe('queued')
    await payload.update({
      collection: 'payload-jobs',
      id: jobId,
      data: { processing: false },
      overrideAccess: true,
    })
  })
})

describe('content-run lease', () => {
  it('claims the run and stamps a heartbeat before any work', async () => {
    const run = await createRun({})
    runPipelineMock.mockImplementation(async () => {
      const running = await readRun(run.id)
      expect(running.status).toBe('running')
      expect(running.heartbeatAt).toBeTruthy()
      return {
        articleIds: [articleId],
        finalStatuses: { brief_review: 1 },
        stages: [],
        failed: 0,
        failures: [],
      }
    })
    await executeContentRun(payload, run)
    const done = await readRun(run.id)
    expect(done.status).toBe('succeeded')
    expect(done.finalStatuses).toEqual({ brief_review: 1 })
  })

  it('refuses a run that recovery already failed before the worker reached it', async () => {
    const run = await createRun({ status: 'failed', errorSummary: 'recovered earlier' })
    await expect(executeContentRun(payload, run)).rejects.toThrow('no longer running')
    expect(runPipelineMock).not.toHaveBeenCalled()
    const after = await readRun(run.id)
    expect(after.status).toBe('failed')
    expect(after.errorSummary).toBe('recovered earlier')
  })

  it('does not write over a run that was recovered while it was working', async () => {
    const run = await createRun({})
    runPipelineMock.mockImplementation(async () => {
      // The worker stalls past the lease; the scheduled task recovers the run.
      await payload.update({
        collection: 'pipeline-runs',
        id: run.id,
        data: { heartbeatAt: ago(RUN_LEASE_TIMEOUT_MS + 60_000) },
        overrideAccess: true,
      })
      const { recoveredRuns } = await recoverStaleRuns(payload)
      expect(recoveredRuns).toContain(run.runId)
      // Then it wakes up and finishes as if nothing happened.
      return {
        articleIds: [articleId],
        finalStatuses: { brief_review: 1 },
        stages: [],
        failed: 0,
        failures: [],
      }
    })

    // A heartbeat interval far longer than the test, so only the fence on the
    // final write can stop it.
    await expect(
      executeContentRun(payload, run, { heartbeatIntervalMs: 60 * 60_000 }),
    ).rejects.toThrow('no longer running')

    const after = await readRun(run.id)
    expect(after.status).toBe('failed')
    expect(after.errorSummary).toContain('worker stopped responding')
    expect(after.finalStatuses ?? null).toBeNull()
  })

  it('aborts the pipeline once its heartbeat finds the run recovered', async () => {
    const run = await createRun({})
    let sawAbort = false
    runPipelineMock.mockImplementation(async (_ctx, options) => {
      await payload.update({
        collection: 'pipeline-runs',
        id: run.id,
        data: { status: 'failed', errorSummary: 'recovered under the worker' },
        overrideAccess: true,
      })
      const signal = options?.signal
      const deadline = Date.now() + 5_000
      while (!signal?.aborted && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      sawAbort = Boolean(signal?.aborted)
      // What the real `runPipeline` does before its next write.
      signal?.throwIfAborted()
      return { articleIds: [], finalStatuses: {}, stages: [], failed: 0, failures: [] }
    })

    await expect(executeContentRun(payload, run, { heartbeatIntervalMs: 20 })).rejects.toThrow(
      'no longer running',
    )
    expect(sawAbort).toBe(true)
    const after = await readRun(run.id)
    expect(after.status).toBe('failed')
    expect(after.errorSummary).toBe('recovered under the worker')
  })
})
