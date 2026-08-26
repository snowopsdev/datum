import type { Payload } from 'payload'

import {
  type LlmSettingsDoc,
  PIPELINE_STAGES,
  type PipelineStage,
  type ResolvedModel,
  resolveStageModels,
} from '../../cms/src/lib/llmSettings'

import { config } from './config'
import { apiKeyForModel, envVarNameForModel } from './llmProvider'

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
        `${stage} model "${model}" (from ${source}) needs ${envVarNameForModel(model)} set (MOCK_MODE=false)`,
      )
    }
    console.log(`[pipeline] ${stage}: ${model} (${source})`)
  }
  // Only worth saying when the operator actually picked the model: every stage
  // resolves to the same platform default out of the box, so an unconditional
  // warning would fire on every run and carry no signal.
  const generateModel = resolved.generate.model
  if (
    resolved.informationGainJudge.source !== 'default' &&
    resolved.informationGainJudge.model === generateModel
  ) {
    console.warn(
      '[pipeline] informationGainJudge uses the generate model; self-judging inflates novelty and utility scores',
    )
  }
  if (
    resolved.evidenceVerification.source !== 'default' &&
    resolved.evidenceVerification.model === generateModel
  ) {
    console.warn(
      '[pipeline] evidenceVerification uses the generate model; prefer an independent verifier',
    )
  }
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [stage, resolved[stage].model]),
  ) as StageModels
}
