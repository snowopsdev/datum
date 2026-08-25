// Shared with the CMS so both workspaces route model ids to providers identically.
export {
  apiKeyForModel,
  envVarNameForModel,
  LLM_PROVIDERS,
  type LlmProvider,
  PROVIDER_ENV_VAR_NAME,
  providerForModel,
} from '../../cms/src/lib/llmProvider'
