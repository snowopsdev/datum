import { DEFAULT_MODEL } from './llmCatalog'

/**
 * Which model each LLM call uses. Resolved the same way in the pipeline and the
 * CMS: the Models global (admin-configurable) wins, then the env override, then
 * the platform default.
 */
export const PIPELINE_STAGES = [
  'generate',
  'factCheck',
  'qualitativeReview',
  'claimExtraction',
  'informationGainJudge',
  'evidenceVerification',
  'evidenceCheck',
  'briefAngle',
] as const
export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const STAGE_ENV_VAR: Record<PipelineStage, string> = {
  generate: 'PIPELINE_MODEL_GENERATE',
  factCheck: 'PIPELINE_MODEL_FACT_CHECK',
  qualitativeReview: 'PIPELINE_MODEL_QUALITATIVE_REVIEW',
  claimExtraction: 'PIPELINE_MODEL_CLAIM_EXTRACTION',
  informationGainJudge: 'PIPELINE_MODEL_INFORMATION_GAIN_JUDGE',
  evidenceVerification: 'PIPELINE_MODEL_EVIDENCE_VERIFICATION',
  evidenceCheck: 'PIPELINE_MODEL_EVIDENCE_CHECK',
  briefAngle: 'PIPELINE_MODEL_BRIEF_ANGLE',
}

export const STAGE_SETTING_FIELD: Record<PipelineStage, keyof LlmSettingsDoc> = {
  generate: 'generateModel',
  factCheck: 'factCheckModel',
  qualitativeReview: 'qualitativeReviewModel',
  claimExtraction: 'claimExtractionModel',
  informationGainJudge: 'informationGainJudgeModel',
  evidenceVerification: 'evidenceVerificationModel',
  evidenceCheck: 'evidenceCheckModel',
  briefAngle: 'briefAngleModel',
}

export const EXTRACTION_ENV_VAR = 'BRAND_VOICE_EXTRACT_MODEL'

export const TOPIC_RELEVANCE_ENV_VAR = 'TOPIC_RELEVANCE_MODEL'

export const SETUP_ASSIST_ENV_VAR = 'SETUP_ASSIST_MODEL'

/** Shape of the `llm-settings` global (all optional: blank means "use env/default"). */
export interface LlmSettingsDoc {
  generateModel?: string | null
  factCheckModel?: string | null
  qualitativeReviewModel?: string | null
  claimExtractionModel?: string | null
  informationGainJudgeModel?: string | null
  evidenceVerificationModel?: string | null
  evidenceCheckModel?: string | null
  briefAngleModel?: string | null
  brandVoiceExtractModel?: string | null
  setupAssistModel?: string | null
  topicRelevanceModel?: string | null
}

/** Every model field on the global, in the order the admin form shows them. */
export const LLM_SETTING_FIELDS = [
  ...PIPELINE_STAGES.map((stage) => STAGE_SETTING_FIELD[stage]),
  'brandVoiceExtractModel',
  'setupAssistModel',
  'topicRelevanceModel',
] as const satisfies readonly (keyof LlmSettingsDoc)[]

/**
 * Has anybody chosen a model at all?
 *
 * Blank everywhere is a working workspace — every call falls through to the
 * platform default — so this is a recommendation on the setup hub, never a
 * gate. It is the honest answer to "did we pick these, or inherit them".
 */
export function llmSettingsConfigured(settings: LlmSettingsDoc | null | undefined): boolean {
  return LLM_SETTING_FIELDS.some((field) => clean(settings?.[field]) !== undefined)
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

/**
 * The default for short structured calls that a small model handles well:
 * the small model of whichever provider the workspace writes with. Unset, these
 * calls must not inherit flagship pricing, and following the writer's provider
 * means a workspace that only holds one provider's key is not blocked for the
 * other's.
 */
export const SMALL_MODEL_BY_PROVIDER = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-5.4-mini',
} as const

export function smallModelLike(model: string): string {
  return model.startsWith('gpt-') ? SMALL_MODEL_BY_PROVIDER.openai : SMALL_MODEL_BY_PROVIDER.anthropic
}

/** Stages whose unset model is `smallModelLike(generate)` rather than the platform default. */
const SMALL_DEFAULT_STAGES: readonly PipelineStage[] = ['briefAngle']

export function resolveStageModels(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): Record<PipelineStage, ResolvedModel> {
  const resolve = (stage: PipelineStage, fallback?: string) =>
    resolveModel(settings?.[STAGE_SETTING_FIELD[stage]], env[STAGE_ENV_VAR[stage]], fallback)
  const generate = resolve('generate')
  return Object.fromEntries(
    PIPELINE_STAGES.map((stage) => [
      stage,
      SMALL_DEFAULT_STAGES.includes(stage)
        ? resolve(stage, smallModelLike(generate.model))
        : resolve(stage),
    ]),
  ) as Record<PipelineStage, ResolvedModel>
}

export function resolveExtractionModel(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedModel {
  return resolveModel(settings?.brandVoiceExtractModel, env[EXTRACTION_ENV_VAR])
}

/**
 * The model behind the setup assistant.
 *
 * It falls back through the brand-voice extraction model before the platform
 * default, because both do the same job — read a workspace's own words and turn
 * them into a governed record — and a workspace that has already chosen a
 * cheaper model for one should not silently pay flagship prices for the other.
 */
export function resolveSetupAssistModel(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedModel {
  const chosen = resolveModel(settings?.setupAssistModel, env[SETUP_ASSIST_ENV_VAR], '')
  if (chosen.model) return chosen
  return resolveExtractionModel(settings, env)
}

/** The model behind topic-fit scoring in discovery; small by default (see `smallModelLike`). */
export function resolveTopicRelevanceModel(
  settings: LlmSettingsDoc | null | undefined,
  env: Record<string, string | undefined>,
): ResolvedModel {
  const generate = resolveStageModels(settings, env).generate.model
  return resolveModel(
    settings?.topicRelevanceModel,
    env[TOPIC_RELEVANCE_ENV_VAR],
    smallModelLike(generate),
  )
}
