/** Fired on `window` once a server action has queued a run. */
export const RUN_QUEUED_EVENT = 'datum:run-queued'

export type RunQueuedDetail = {
  /** The run the action created, when its result says so. */
  runId?: string
  /** Browser clock at the moment of the action, ms since epoch. */
  queuedAt: number
}

/**
 * Tell the run bar a run was just queued, so it polls now instead of on the
 * 15 s idle cadence and does not show an older finished run in the meantime.
 *
 * Safe to call from anywhere: a no-op without a `window`.
 */
export function announceRunQueued(detail: { runId?: string } = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<RunQueuedDetail>(RUN_QUEUED_EVENT, {
      detail: { runId: detail.runId, queuedAt: Date.now() },
    }),
  )
}

/**
 * Allowance for the browser and the database disagreeing about the time, used
 * only when an announcement has no run id to match on.
 */
const CLOCK_SKEW_MS = 2000

/**
 * A polled run that predates the announced action, so it cannot be the run the
 * operator just asked for. Matching on the id is exact; the creation time is
 * the fallback for call sites whose result does not carry one.
 */
export function isStaleRun(
  run: { runId: string; createdAtIso: string },
  announced: RunQueuedDetail,
): boolean {
  if (announced.runId !== undefined) return run.runId !== announced.runId
  return new Date(run.createdAtIso).getTime() < announced.queuedAt - CLOCK_SKEW_MS
}
