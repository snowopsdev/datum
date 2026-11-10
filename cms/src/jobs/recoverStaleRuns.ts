import type { TaskConfig } from 'payload'

import { recoverStaleRuns } from '../lib/pipelineRunLease'

type RecoverStaleRunsTask = {
  input: object
  output: { recoveredRuns: string[]; failedJobs: Array<number | string> }
}

/**
 * Fails pipeline runs whose worker (or CLI) stopped refreshing its heartbeat,
 * and frees the `content-pipeline` concurrency key the dead worker's job still
 * holds. Without it, one killed process left a `running` row that refused every
 * later admin run and its articles forever, and a `processing` job that every
 * later content run queued behind. See `lib/pipelineRunLease.ts`.
 *
 * On the `scheduled` queue beside `publish-due`, not on `content`: the job it
 * exists to release is the one blocking that queue.
 */
export const RecoverStaleRunsTask: TaskConfig<RecoverStaleRunsTask> = {
  slug: 'recover-stale-runs',
  label: 'Recover stale pipeline runs',
  retries: 0,
  schedule: [{ cron: '0 */5 * * * *', queue: 'scheduled' }],
  inputSchema: [],
  outputSchema: [
    { name: 'recoveredRuns', type: 'json', required: true },
    { name: 'failedJobs', type: 'json', required: true },
  ],
  async handler({ req }) {
    return { output: await recoverStaleRuns(req.payload) }
  },
}
