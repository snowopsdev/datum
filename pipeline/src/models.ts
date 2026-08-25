import type { Payload } from 'payload'

import {
  type LlmSettingsDoc,
  PIPELINE_STAGES,
  type PipelineStage,
  type ResolvedModel,
  resolveStageModels,
} from '../../cms/src/lib/llmSettings'

import { config } from './config'
import { apiKeyForModel, PROVIDER_API_KEY_ENV, providerForModel } from './llmProvider'

export type StageModels = Record<PipelineStage, string>

/**
 * Resolve the model for each LLM stage once per run: the admin's Models global
 * beats the PIPELINE_MODEL_* env overrides, which beat the default. Outside
 * mock mode every chosen model must have its provider's API key, checked here
 * (not at config load) because the database has a say.
 */
export async function loadStageModels(payload: Payload): Promise<StageModels> {
  const settings = (await payload.findGlobal({ slug: 'llm-settings', depth: 0 })) as LlmSettingsDoc
  const resolved = resolveStageModels(settings, process.env)
  for (const stage of PIPELINE_STAGES) {
    const { model, source } = resolved[stage] as ResolvedModel
    if (!config.mockMode && apiKeyForModel(model, process.env) === undefined) {
      throw new Error(
        `${stage} model "${model}" (from ${source}) needs ${PROVIDER_API_KEY_ENV[providerForModel(model)]} set (MOCK_MODE=false)`,
      )
    }
    console.log(`[pipeline] ${stage}: ${model} (${source})`)
  }
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, resolved[stage].model]),
  ) as StageModels
}
