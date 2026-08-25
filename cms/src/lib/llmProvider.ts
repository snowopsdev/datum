/**
 * Which API a model id belongs to. Shared by the pipeline (`llm.ts`) and the
 * CMS (brand-voice extraction) so both route the same way: the model id alone
 * decides the provider — no separate provider flag to keep in sync.
 */
export type LlmProvider = 'anthropic' | 'openai'

export const LLM_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai']

export const PROVIDER_API_KEY_ENV: Record<LlmProvider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/** `gpt-*`, `o1`/`o3`/`o4-*`, `chatgpt-*` → OpenAI; everything else (`claude-*`) → Anthropic. */
export function providerForModel(model: string): LlmProvider {
  return /^(gpt-|o\d|chatgpt-)/i.test(model.trim()) ? 'openai' : 'anthropic'
}

/** The API key the given model needs, read from an env-like record. */
export function apiKeyForModel(
  model: string,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[PROVIDER_API_KEY_ENV[providerForModel(model)]] || undefined
}
