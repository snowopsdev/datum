import type { Payload, TaskConfig } from 'payload'

import { fetchTopics } from '../../../pipeline/src/fetchTopics'
import { buildStageContext, loadStageInputs } from '../../../pipeline/src/runContext'
import { runPipeline } from '../../../pipeline/src/stages'
import type { PipelineRun } from '../payload-types'

type ContentRunTask = {
  input: { runId: string }
  output: { articleIds: number[]; finalStatuses: Record<string, number> }
}

function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : 'Content run failed'
  for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AHREFS_API_KEY', 'PAYLOAD_SECRET']) {
    const secret = process.env[name]
    if (secret) message = message.replaceAll(secret, '[redacted]')
  }
  return message.replace(/(sk-|api[_-]?key[=: ]+)[^\s,;]+/gi, '$1[redacted]').slice(0, 500)
}

async function executeContentRun(payload: Payload, run: PipelineRun) {
  const startedAt = new Date().toISOString()
  await payload.update({
    collection: 'pipeline-runs',
    id: run.id,
    overrideAccess: true,
    data: { status: 'running', startedAt, errorSummary: null },
  })

  try {
    const templateId = typeof run.template === 'object' ? run.template.id : run.template
    let articleIds: number[]
    const inputs = await loadStageInputs(payload, run.mode)
    const { tenant, brandVoice } = inputs
    // Re-check before discovery: a queued run may outlive an asset's activation.
    if (!brandVoice || !tenant.profile.targetDomain || tenant.icps.length === 0) {
      throw new Error(
        'Finish setup: brand voice, target domain, and at least one active audience (ICP) are required.',
      )
    }
    const stageContext = buildStageContext(payload, run.runId, run.mode, inputs)

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

    await payload.update({
      collection: 'pipeline-runs',
      id: run.id,
      overrideAccess: true,
      data: { articles: articleIds },
    })

    const result = await runPipeline(stageContext, { articleIds })
    const completedAt = new Date().toISOString()
    // A run that advanced nothing is not a success, whatever the job queue
    // thinks. `runPipeline` deliberately swallows a single article's failure so
    // the rest of the batch survives, which means the only signal that anything
    // went wrong is `result.failed` — and reporting `succeeded` regardless left
    // an operator staring at a card that had not moved with nowhere to look.
    const advanced = Object.values(result.finalStatuses).reduce((sum, n) => sum + n, 0)
    const status = advanced === 0 && result.failed > 0 ? 'failed' : 'succeeded'
    await payload.update({
      collection: 'pipeline-runs',
      id: run.id,
      overrideAccess: true,
      data: {
        status,
        articles: articleIds,
        finalStatuses: result.finalStatuses,
        warnings: result.failures.length > 0 ? result.failures : null,
        errorSummary:
          result.failures.length > 0
            ? result.failures
                .map((f) => `${f.stage}: "${f.keyword}" — ${safeError(new Error(f.message))}`)
                .join('\n\n')
            : null,
        completedAt,
      },
    })
    return result
  } catch (error) {
    const errorSummary = safeError(error)
    await payload.update({
      collection: 'pipeline-runs',
      id: run.id,
      overrideAccess: true,
      data: {
        status: 'failed',
        errorSummary,
        completedAt: new Date().toISOString(),
      },
    })
    throw new Error(errorSummary)
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
