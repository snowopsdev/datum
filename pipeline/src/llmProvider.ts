// Shared with the CMS so both workspaces route model ids to providers identically.
export {
  apiKeyForModel,
  LLM_PROVIDERS,
  type LlmProvider,
  PROVIDER_API_KEY_ENV,
  providerForModel,
} from '../../cms/src/lib/llmProvider'
