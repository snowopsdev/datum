// Shared with the CMS so both workspaces route model ids to providers identically.
export {
  apiKeyForModel,
  type ApiKeyProvider,
  CODEX_MODEL_PREFIX,
  codexModelId,
  describeRequirement,
  envVarNameForModel,
  LLM_PROVIDERS,
  type LlmProvider,
  PROVIDER_ENV_VAR_NAME,
  providerForModel,
  type ProviderRequirement,
  requirementForModel,
} from '../../cms/src/lib/llmProvider'
