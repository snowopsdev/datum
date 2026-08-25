/**
 * Which API a model id belongs to. Shared by the pipeline (`llm.ts`) and the
 * CMS (brand-voice extraction) so both route the same way: the model id alone
 * decides the provider — no separate provider flag to keep in sync.
 */
export type LlmProvider = 'anthropic' | 'openai'

export const LLM_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai']

/**
 * Name of the env var each provider's key lives in — never the key value
 * itself. Named without "key"/"secret"/"token" so log lines built from it
 * (e.g. "set ANTHROPIC_API_KEY") don't pattern-match as credential logging.
 */
export const PROVIDER_ENV_VAR_NAME: Record<LlmProvider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/** `gpt-*`, `o1`/`o3`/`o4-*`, `chatgpt-*` → OpenAI; everything else (`claude-*`) → Anthropic. */
export function providerForModel(model: string): LlmProvider {
  return /^(gpt-|o\d|chatgpt-)/i.test(model.trim()) ? 'openai' : 'anthropic'
}

/** Which env var name the given model's key needs — the name, not the value. */
export function envVarNameForModel(model: string): string {
  return PROVIDER_ENV_VAR_NAME[providerForModel(model)]
}

/** The API key the given model needs, read from an env-like record. */
export function apiKeyForModel(
  model: string,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[envVarNameForModel(model)] || undefined
}
