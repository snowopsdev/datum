import { DEFAULT_MODEL } from './llmCatalog'

/**
 * Which model each LLM call uses. Resolved the same way in the pipeline and the
 * CMS: the Models global (admin-configurable) wins, then the env override, then
 * the platform default.
 */
export const PIPELINE_STAGES = ['generate', 'factCheck', 'qualitativeReview'] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_ENV_VAR: Record<PipelineStage, string> = {
  generate: 'PIPELINE_MODEL_GENERATE',
  factCheck: 'PIPELINE_MODEL_FACT_CHECK',
  qualitativeReview: 'PIPELINE_MODEL_QUALITATIVE_REVIEW',
}

export const STAGE_SETTING_FIELD: Record<PipelineStage, keyof LlmSettingsDoc> = {
  generate: 'generateModel',
  factCheck: 'factCheckModel',
  qualitativeReview: 'qualitativeReviewModel',
}

export const EXTRACTION_ENV_VAR = 'BRAND_VOICE_EXTRACT_MODEL'

/** Shape of the `llm-settings` global (all optional: blank means "use env/default"). */
export interface LlmSettingsDoc {
  generateModel?: string | null
  factCheckModel?: string | null
  qualitativeReviewModel?: string | null
  brandVoiceExtractModel?: string | null
}

export type ModelSource = 'admin' | 'env' | 'default'

export interface ResolvedModel {
  model: string
  source: ModelSource
}

const clean = (value: string | null | undefined): string | undefined => value?.trim() || undefined

export function resolveModel(
  setting: string | null | undefined,
  envValue: string | undefined,
  fallback = DEFAULT_MODEL,
): ResolvedModel {
  const fromAdmin = clean(setting)
  if (fromAdmin) return { model: fromAdmin, source: 'admin' }
  const fromEnv = clean(envValue)
  if (fromEnv) return { model: fromEnv, source: 'env' }
  return { model: fallback, source: 'default' }
}

export function resolveStageModels(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): Record<PipelineStage, ResolvedModel> {
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [
      stage,
      resolveModel(settings?.[STAGE_SETTING_FIELD[stage]], env[STAGE_ENV_VAR[stage]]),
    ]),
  ) as Record<PipelineStage, ResolvedModel>
}

export function resolveExtractionModel(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedModel {
  return resolveModel(settings?.brandVoiceExtractModel, env[EXTRACTION_ENV_VAR])
}
