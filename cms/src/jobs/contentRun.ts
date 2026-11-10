import type { Payload, TaskConfig } from 'payload'

import { fetchTopics } from '../../../pipeline/src/fetchTopics'
import { buildStageContext, loadStageInputs } from '../../../pipeline/src/runContext'
import { runPipeline } from '../../../pipeline/src/stages'
import {
  RUN_HEARTBEAT_INTERVAL_MS,
  type RunHeartbeat,
  RunLeaseLostError,
  safeRunError,
  settledRunData,
  startRunHeartbeat,
  updateRunIfStatus,
} from '../lib/pipelineRunLease'
import type { PipelineRun } from '../payload-types'

type ContentRunTask = {
  input: { runId: string }
  output: { articleIds: number[]; finalStatuses: Record<string, number> }
}

export interface ExecuteContentRunOptions {
  /** How often the lease is refreshed; tests shorten it. */
  heartbeatIntervalMs?: number
}

export async function executeContentRun(
  payload: Payload,
  run: PipelineRun,
  { heartbeatIntervalMs = RUN_HEARTBEAT_INTERVAL_MS }: ExecuteContentRunOptions = {},
) {
  let heartbeat: RunHeartbeat | null = null
  // Whether this handler moved the row to `running`. Before that the row is
  // still `queued` (or someone else's), and the catch below must settle it as
  // such: the job has no retries, so a queued row left behind blocks every
  // later run until someone deletes it.
  let claimed = false
  // Every write below is fenced on the status the run expects to find, so a
  // run that recovery failed under this worker is never written back over.
  const writeRunning = async (data: Partial<PipelineRun>) => {
    if (!(await updateRunIfStatus(payload, run.id, 'running', data))) {
      throw new RunLeaseLostError(run.runId)
    }
  }

  try {
    const startedAt = new Date().toISOString()
    // The claim: only a queued row becomes running. A row recovery already
    // failed stays failed, and the job ends without touching it.
    claimed = await updateRunIfStatus(payload, run.id, 'queued', {
      status: 'running',
      startedAt,
      heartbeatAt: startedAt,
      errorSummary: null,
    })
    if (!claimed) throw new RunLeaseLostError(run.runId)
    heartbeat = startRunHeartbeat(payload, run, heartbeatIntervalMs)

    const templateId = typeof run.template === 'object' ? run.template?.id : run.template
    let articleIds: number[]
    const inputs = await loadStageInputs(payload, run.mode)
    const { tenant, brandVoice } = inputs
    // Re-check before discovery: a queued run may outlive an asset's activation.
    if (!brandVoice || !tenant.profile.targetDomain || tenant.icps.length === 0) {
      throw new Error(
        'Finish setup: brand voice, target domain, and at least one active audience (ICP) are required.',
      )
    }
    // The signal reaches discovery and every model call, so a recovered run
    // stops between steps rather than at its next article write.
    const stageContext = {
      ...buildStageContext(payload, run.runId, run.mode, inputs),
      signal: heartbeat.signal,
    }

    if (run.source === 'selected') {
      // The articles were chosen by a person and attached when the run was
      // created, so there is nothing to discover. This is the only source that
      // advances work already on the board rather than buying new topics.
      articleIds = (run.articles ?? []).map((entry) =>
        typeof entry === 'object' ? entry.id : entry,
      )
      if (articleIds.length === 0) {
        throw new Error('This run has no articles attached.')
      }
    } else {
      if (templateId == null) throw new Error('This run has no template to discover topics for.')
      heartbeat.signal.throwIfAborted()
      const fetched = await fetchTopics(stageContext, {
        count: run.requestedCount,
        templateId,
        icpId: (tenant.icps.find((icp) => icp.primary)?.id as number | undefined) ?? null,
      })
      articleIds = fetched.createdIds
      if (articleIds.length === 0) {
        throw new Error('No new content-gap topics were available for this template.')
      }
    }

    await writeRunning({ articles: articleIds })

    const result = await runPipeline(stageContext, {
      articleIds,
      signal: heartbeat.signal,
      commitArticle: heartbeat.commit,
    })
    await writeRunning({ ...settledRunData(result), articles: articleIds })
    return result
  } catch (error) {
    const errorSummary = safeRunError(error)
    // Fenced too: a lost lease means the row already says what happened, and
    // before the claim only a row still `queued` is ours to fail — never a
    // row another handler is running.
    if (!(error instanceof RunLeaseLostError)) {
      await updateRunIfStatus(payload, run.id, claimed ? 'running' : 'queued', {
        status: 'failed',
        errorSummary,
        completedAt: new Date().toISOString(),
      }).catch((settleError) => {
        payload.logger.error(`could not mark run ${run.runId} failed: ${safeRunError(settleError)}`)
      })
    }
    throw new Error(errorSummary)
  } finally {
    heartbeat?.stop()
  }
}

export const ContentRunTask: TaskConfig<ContentRunTask> = {
  slug: 'content-run',
  label: 'Content pipeline run',
  concurrency: () => 'content-pipeline',
  retries: 0,
  inputSchema: [{ name: 'runId', type: 'text', required: true }],
  outputSchema: [
    { name: 'articleIds', type: 'json', required: true },
    { name: 'finalStatuses', type: 'json', required: true },
  ],
  async handler({ input, req }) {
    const result = await req.payload.find({
      collection: 'pipeline-runs',
      where: { runId: { equals: input.runId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const run = result.docs[0]
    if (!run) throw new Error(`Pipeline run ${input.runId} does not exist.`)
    const output = await executeContentRun(req.payload, run)
    return { output }
  },
}
