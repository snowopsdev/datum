import type { GlobalConfig } from 'payload'

import { LLM_MODEL_OPTIONS } from '../lib/llmCatalog'
import { EXTRACTION_ENV_VAR, STAGE_ENV_VAR } from '../lib/llmSettings'

const modelField = (name: string, label: string, envVar: string, purpose: string) => ({
  name,
  type: 'select' as const,
  label,
  options: [...LLM_MODEL_OPTIONS],
  admin: {
    description: `${purpose} Leave blank to use ${envVar} from the environment, or the platform default (Claude Opus 5).`,
    isClearable: true,
  },
})

/**
 * Admin-configurable model choice per LLM call. Read once per pipeline run
 * (`pipeline/src/models.ts`) and per brand-guide extraction. An admin choice
 * beats the env override, which beats the default. `MOCK_MODE=true` still
 * mocks everything regardless of the choice.
 */
export const LlmSettings: GlobalConfig = {
  slug: 'llm-settings',
  label: 'Models',
  admin: {
    group: false,
    description:
      'Which model handles each step. Each model needs its provider key (ANTHROPIC_API_KEY or OPENAI_API_KEY) in the environment; a codex/ model needs `codex login` on the host instead of a key. Prices are USD per 1M tokens and feed the cost log; codex prices are estimates at API rates, not what your ChatGPT plan charges.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    modelField(
      'generateModel',
      'Generate',
      STAGE_ENV_VAR.generate,
      'Writes the article draft from the template, research, and brand voice.',
    ),
    modelField(
      'factCheckModel',
      'Fact check',
      STAGE_ENV_VAR.factCheck,
      'Verifies claims with web search during QA.',
    ),
    modelField(
      'qualitativeReviewModel',
      'Qualitative review',
      STAGE_ENV_VAR.qualitativeReview,
      'Judges style guide, template rules, and brand voice fit during QA.',
    ),
    modelField(
      'claimExtractionModel',
      'Claim extraction',
      STAGE_ENV_VAR.claimExtraction,
      'Decomposes ranking pages, published articles, and drafts into atomic claims and clusters consensus facets.',
    ),
    modelField(
      'informationGainJudgeModel',
      'Information-gain judge',
      STAGE_ENV_VAR.informationGainJudge,
      'Scores draft claims for novelty, relevance, utility, and duplication against the baseline corpus.',
    ),
    modelField(
      'evidenceVerificationModel',
      'Evidence verification',
      STAGE_ENV_VAR.evidenceVerification,
      'Web-searches evidence for materially novel claims during information-gain review.',
    ),
    modelField(
      'brandVoiceExtractModel',
      'Brand voice extraction',
      EXTRACTION_ENV_VAR,
      'Turns an uploaded brand guide into a brand voice draft.',
    ),
  ],
}
