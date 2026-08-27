import type { Payload, TaskConfig } from 'payload'

import { createAhrefsClient } from '../../../pipeline/src/ahrefs'
import { loadActiveBrandVoice } from '../../../pipeline/src/brandVoice'
import { type FetchContext, fetchTopics } from '../../../pipeline/src/fetchTopics'
import {
  loadEvidenceSources,
  loadInformationGainPolicy,
} from '../../../pipeline/src/informationGain/policy'
import { createLlmClient } from '../../../pipeline/src/llm'
import { loadStageModels } from '../../../pipeline/src/models'
import { runPipeline, type StageContext } from '../../../pipeline/src/stages'
import { loadStyleGuide } from '../../../pipeline/src/styleGuide'
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
    const fetchContext: FetchContext = {
      payload,
      runId: run.runId,
      mode: run.mode,
      ahrefs: createAhrefsClient(),
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
    } else if (run.source === 'onboarding') {
      const sample = await payload.create({
        collection: 'articles',
        overrideAccess: true,
        data: {
          keyword: `governed content pipeline demo ${run.runId.slice(0, 8)}`,
          template: templateId,
          status: 'topic_selected',
        },
        context: {
          articleAudit: {
            actor: 'pipeline',
            actorType: 'pipeline',
            event: 'onboarding_sample_created',
            pipelineRunId: run.runId,
            summary: 'Onboarding verification sample created',
          },
        },
      })
      articleIds = [sample.id]
    } else {
      const fetched = await fetchTopics(fetchContext, {
        count: run.requestedCount,
        templateId,
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

    const brandVoice = await loadActiveBrandVoice(payload)
    if (!brandVoice) throw new Error('Activate a brand voice before running the pipeline.')
    const stageContext: StageContext = {
      ...fetchContext,
      styleGuide: loadStyleGuide(),
      models: await loadStageModels(payload),
      brandVoice,
      policy: await loadInformationGainPolicy(payload),
      evidenceSources: await loadEvidenceSources(payload),
      llm: createLlmClient(run.mode),
    }
    const result = await runPipeline(stageContext, { articleIds })
    const completedAt = new Date().toISOString()
    await payload.update({
      collection: 'pipeline-runs',
      id: run.id,
      overrideAccess: true,
      data: {
        status: 'succeeded',
        articles: articleIds,
        finalStatuses: result.finalStatuses,
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
