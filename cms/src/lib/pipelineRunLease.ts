import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import type { RunPipelineResult } from '../../../pipeline/src/stages'
import type { PipelineRun } from '../payload-types'

/**
 * The lease a running pipeline run holds on its `pipeline-runs` row.
 *
 * A run is `running` only while something refreshes `heartbeatAt`: the content
 * worker and the `pipeline run` CLI both start a heartbeat when they claim the
 * row and stop it when they settle it. A process that dies stops refreshing,
 * and `recoverStaleRuns` (the `recover-stale-runs` task) fails the row once the
 * heartbeat is older than `RUN_LEASE_TIMEOUT_MS`. Elapsed time alone never
 * releases a run: a long run whose worker is alive keeps its lease.
 *
 * Every write a run makes to its own row after it starts is fenced on the
 * status it expects (`updateRunIfStatus`), under a row lock that recovery takes
 * too. A worker that comes back after its run was recovered therefore cannot
 * overwrite the recovered state, and its heartbeat aborts the run instead.
 */

export const RUN_HEARTBEAT_INTERVAL_MS = 60_000
export const RUN_LEASE_TIMEOUT_MS = 15 * 60_000

type RunStatus = PipelineRun['status']

/** Thrown into a run whose row was recovered (or otherwise settled) under it. */
export class RunLeaseLostError extends Error {
  constructor(readonly runId: string) {
    super(
      `Run ${runId} is no longer running: it was marked failed (by recover-stale-runs, once its heartbeat lapsed), so this process stopped without writing to it.`,
    )
    this.name = 'RunLeaseLostError'
  }
}

/** Strip anything that looks like a credential before an error is stored on a run row. */
export function safeRunError(error: unknown, fallback = 'Content run failed'): string {
  let message = error instanceof Error ? error.message : fallback
  for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AHREFS_API_KEY', 'PAYLOAD_SECRET']) {
    const secret = process.env[name]
    if (secret) message = message.replaceAll(secret, '[redacted]')
  }
  return message.replace(/(sk-|api[_-]?key[=: ]+)[^\s,;]+/gi, '$1[redacted]').slice(0, 500)
}

/** What a finished pipeline result leaves on its run row; shared with the CLI. */
export function settledRunData(result: RunPipelineResult) {
  // A run that advanced nothing is not a success, whatever the job queue
  // thinks. `runPipeline` deliberately swallows a single article's failure so
  // the rest of the batch survives, which means the only signal that anything
  // went wrong is `result.failed` — and reporting `succeeded` regardless left
  // an operator staring at a card that had not moved with nowhere to look.
  const advanced = Object.values(result.finalStatuses).reduce((sum, n) => sum + n, 0)
  return {
    status: advanced === 0 && result.failed > 0 ? ('failed' as const) : ('succeeded' as const),
    finalStatuses: result.finalStatuses,
    warnings: result.failures.length > 0 ? result.failures : null,
    errorSummary:
      result.failures.length > 0
        ? result.failures
            .map((f) => `${f.stage}: "${f.keyword}" — ${safeRunError(new Error(f.message))}`)
            .join('\n\n')
        : null,
    completedAt: new Date().toISOString(),
  }
}

type SqlExecutor = {
  execute: (query: unknown) => Promise<{ rows: Array<Record<string, unknown>> }>
}

interface LockedRunRow {
  runId: string | null
  status: RunStatus | null
  heartbeatAt: Date | null
  startedAt: Date | null
  createdAt: Date | null
}

const asDate = (value: unknown): Date | null =>
  value == null ? null : value instanceof Date ? value : new Date(String(value))

/**
 * Run `fn` holding a row lock on one `pipeline-runs` row, inside a transaction
 * whose request `fn` must pass to any Payload write. Recovery and every fenced
 * write go through here, so the status check and the write are atomic with
 * respect to each other.
 */
async function withRunRowLock<T>(
  payload: Payload,
  id: number,
  fn: (row: LockedRunRow, req: PayloadRequest) => Promise<T>,
): Promise<T> {
  const transactionID = await payload.db.beginTransaction({ isolationLevel: 'read committed' })
  if (transactionID == null) throw new Error('The database could not start a run transaction.')
  try {
    const session = (
      payload.db as typeof payload.db & { sessions: Record<string, { db: SqlExecutor }> }
    ).sessions[String(transactionID)]?.db
    if (!session) throw new Error('The run transaction session is unavailable.')
    const { rows } = await session.execute(
      sql`SELECT run_id, status, heartbeat_at, started_at, created_at FROM pipeline_runs WHERE id = ${id} FOR UPDATE`,
    )
    const raw = rows[0]
    const row: LockedRunRow = {
      runId: (raw?.run_id as string | undefined) ?? null,
      status: (raw?.status as RunStatus | undefined) ?? null,
      heartbeatAt: asDate(raw?.heartbeat_at),
      startedAt: asDate(raw?.started_at),
      createdAt: asDate(raw?.created_at),
    }
    const req = await createLocalReq({ req: { transactionID } }, payload)
    const value = await fn(row, req)
    await payload.db.commitTransaction(transactionID)
    return value
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

/**
 * Write `data` to the run row only if it is still at `expected`. Returns false,
 * having written nothing, when the row has moved on — recovered, or settled by
 * someone else.
 */
export async function updateRunIfStatus(
  payload: Payload,
  id: number,
  expected: RunStatus,
  data: Partial<PipelineRun>,
): Promise<boolean> {
  return withRunRowLock(payload, id, async (row, req) => {
    if (row.status !== expected) return false
    await payload.update({
      collection: 'pipeline-runs',
      id,
      data,
      depth: 0,
      overrideAccess: true,
      req,
    })
    return true
  })
}

/**
 * Refresh the lease. One atomic UPDATE, fenced on `running`; false when the row
 * is no longer running, which is the holder's cue to stop.
 */
export async function touchRunHeartbeat(payload: Payload, id: number): Promise<boolean> {
  const now = new Date().toISOString()
  const { rows } = await (payload.db as unknown as { drizzle: SqlExecutor }).drizzle.execute(
    sql`UPDATE pipeline_runs SET heartbeat_at = ${now}, updated_at = ${now} WHERE id = ${id} AND status = 'running' RETURNING id`,
  )
  return rows.length > 0
}

export interface RunHeartbeat {
  /** Aborted once the row is found no longer `running`. */
  signal: AbortSignal
  /**
   * Run `write` with a request inside a transaction that holds the run row
   * lock, only if the row is still this run's and still `running`. Otherwise
   * aborts `signal` and resolves false without calling `write`. The timer alone
   * leaves up to a minute in which a recovered run could still write; this
   * closes it for every article write the stage loop commits.
   */
  commit(write: (req: PayloadRequest) => Promise<void>): Promise<boolean>
  stop(): void
}

/**
 * Refresh `heartbeatAt` every `intervalMs` until stopped. When a refresh finds
 * the row recovered, the signal aborts with a `RunLeaseLostError` so the run
 * stops before its next write. A refresh that fails outright (the database is
 * briefly unreachable) is logged and retried on the next tick: the lease has
 * fifteen minutes of slack for exactly that.
 */
export function startRunHeartbeat(
  payload: Payload,
  run: Pick<PipelineRun, 'id' | 'runId'>,
  intervalMs = RUN_HEARTBEAT_INTERVAL_MS,
): RunHeartbeat {
  const controller = new AbortController()
  let inFlight = false
  const timer = setInterval(() => {
    if (inFlight || controller.signal.aborted) return
    inFlight = true
    touchRunHeartbeat(payload, run.id)
      .then((alive) => {
        if (!alive) {
          clearInterval(timer)
          controller.abort(new RunLeaseLostError(run.runId))
        }
      })
      .catch((error) => {
        payload.logger.warn(
          `heartbeat for run ${run.runId} failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      })
      .finally(() => {
        inFlight = false
      })
  }, intervalMs)
  // A heartbeat must never be what keeps a finished CLI process alive.
  timer.unref?.()
  return {
    signal: controller.signal,
    commit: async (write) => {
      if (controller.signal.aborted) return false
      const owned = await withRunRowLock(payload, run.id, async (row, req) => {
        if (row.status !== 'running' || row.runId !== run.runId) return false
        await write(req)
        return true
      })
      if (!owned) {
        clearInterval(timer)
        controller.abort(new RunLeaseLostError(run.runId))
      }
      return owned
    },
    stop: () => clearInterval(timer),
  }
}

/** The lease's age reference: the last heartbeat, else the start, else creation. */
function leaseSince(
  row: Pick<LockedRunRow, 'heartbeatAt' | 'startedAt' | 'createdAt'>,
): Date | null {
  return row.heartbeatAt ?? row.startedAt ?? row.createdAt
}

export interface RecoverStaleRunsResult {
  /** `runId`s marked failed because their lease expired. */
  recoveredRuns: string[]
  /** `payload-jobs` ids released from `processing` and marked failed. */
  failedJobs: Array<number | string>
}

/**
 * Fail every run whose lease has expired, and release the content job that
 * held the `content-pipeline` concurrency key for it.
 *
 * A run is stale when it is `running` and its `heartbeatAt` (or, for a row
 * written before heartbeats existed, its `startedAt`) is older than
 * `timeoutMs`. Each candidate is re-checked under the row lock, so a heartbeat
 * that lands between the query and the write keeps its run alive.
 *
 * Jobs: Payload treats a `content-run` job with `processing: true` as holding
 * the concurrency key, and nothing but the worker that took it ever clears the
 * flag. So a job is released when its run was just recovered, or when the
 * queue has not touched it for `timeoutMs` and its run is not `running` (the
 * worker died after taking the job but before claiming the run; that run is
 * still `queued` and is failed with it). A released job is marked the way
 * Payload marks a job that ran out of retries — `hasError`, not processing —
 * so it is never picked up again.
 */
export async function recoverStaleRuns(
  payload: Payload,
  { now = new Date(), timeoutMs = RUN_LEASE_TIMEOUT_MS }: { now?: Date; timeoutMs?: number } = {},
): Promise<RecoverStaleRunsResult> {
  const cutoff = new Date(now.getTime() - timeoutMs)
  const cutoffIso = cutoff.toISOString()
  const minutes = Math.round(timeoutMs / 60_000)

  const { docs: candidates } = await payload.find({
    collection: 'pipeline-runs',
    where: {
      and: [
        { status: { equals: 'running' } },
        {
          or: [
            { heartbeatAt: { less_than: cutoffIso } },
            {
              and: [{ heartbeatAt: { exists: false } }, { startedAt: { less_than: cutoffIso } }],
            },
            {
              and: [
                { heartbeatAt: { exists: false } },
                { startedAt: { exists: false } },
                { createdAt: { less_than: cutoffIso } },
              ],
            },
          ],
        },
      ],
    },
    select: { runId: true },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const recoveredRuns: string[] = []
  for (const candidate of candidates) {
    const recovered = await withRunRowLock(payload, candidate.id, async (row, req) => {
      const since = leaseSince(row)
      if (row.status !== 'running' || !since || since >= cutoff) return false
      await payload.update({
        collection: 'pipeline-runs',
        id: candidate.id,
        data: {
          status: 'failed',
          completedAt: now.toISOString(),
          errorSummary:
            `The worker stopped responding: no heartbeat since ${since.toISOString()}, ` +
            `so Datum marked this run failed after ${minutes} minutes. Articles keep the ` +
            'status they last saved; start a new run to carry on.',
        },
        depth: 0,
        overrideAccess: true,
        req,
      })
      return true
    })
    if (recovered) {
      recoveredRuns.push(candidate.runId)
      payload.logger.warn(`recovered stale pipeline run ${candidate.runId}`)
    }
  }

  const { docs: jobs } = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { taskSlug: { equals: 'content-run' } },
        { processing: { equals: true } },
        { completedAt: { exists: false } },
      ],
    },
    select: { input: true, updatedAt: true, totalTried: true },
    pagination: false,
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })

  const failedJobs: Array<number | string> = []
  for (const job of jobs) {
    const runId = (job.input as { runId?: unknown } | null | undefined)?.runId
    if (typeof runId !== 'string') continue
    let release = recoveredRuns.includes(runId)
    if (!release && new Date(job.updatedAt) < cutoff) {
      const { docs } = await payload.find({
        collection: 'pipeline-runs',
        where: { runId: { equals: runId } },
        select: { status: true },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const run = docs[0]
      // A `running` run here has a fresh lease (stale ones were failed above),
      // so its worker is alive and the job is genuinely in progress.
      if (run?.status === 'running') continue
      release = true
      if (run?.status === 'queued') {
        const failed = await updateRunIfStatus(payload, run.id, 'queued', {
          status: 'failed',
          completedAt: now.toISOString(),
          errorSummary:
            `The worker took this run's job but stopped responding before starting it; ` +
            `Datum marked the run failed after ${minutes} minutes. Start a new run to carry on.`,
        })
        if (failed) recoveredRuns.push(runId)
      }
    }
    if (!release) continue
    const result = await payload.update({
      collection: 'payload-jobs',
      where: { and: [{ id: { equals: job.id } }, { processing: { equals: true } }] },
      data: {
        processing: false,
        hasError: true,
        totalTried: (job.totalTried ?? 0) + 1,
        error: {
          message: `Released by recover-stale-runs: run ${runId} stopped responding.`,
        },
      },
      depth: 0,
      overrideAccess: true,
    })
    if (result.docs.length > 0) failedJobs.push(job.id)
  }

  return { recoveredRuns, failedJobs }
}
