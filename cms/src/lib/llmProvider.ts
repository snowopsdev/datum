/**
 * Which API a model id belongs to. Shared by the pipeline (`llm.ts`) and the
 * CMS (brand-voice extraction) so both route the same way: the model id alone
 * decides the provider — no separate provider flag to keep in sync. An id we
 * cannot serve is `unknown`, which carries no credential and can never run
 * live.
 */
export type LlmProvider = 'anthropic' | 'openai' | 'unknown'

/** The providers whose credential is an API key in the environment. */
export type ApiKeyProvider = Exclude<LlmProvider, 'unknown'>

export const LLM_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'unknown']

/**
 * Name of the env var each provider's key lives in — never the key value
 * itself. Named without "key"/"secret"/"token" so log lines built from it
 * (e.g. "set ANTHROPIC_API_KEY") don't pattern-match as credential logging.
 */
export const PROVIDER_ENV_VAR_NAME: Record<ApiKeyProvider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/** What a model needs before it can run: a key in the environment. */
export type ProviderRequirement = { kind: 'env'; envVar: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' }

/**
 * `gpt-*`, `o1`/`o3`/`o4-*`, `chatgpt-*` → OpenAI; everything else (`claude-*`)
 * → Anthropic. A vendor-namespaced id (`something/model`) belongs to neither
 * API we call — legacy `codex/*` selections land here — so it is `unknown` and
 * stays unrunnable rather than being guessed into a provider.
 */
export function providerForModel(model: string): LlmProvider {
  const id = model.trim()
  if (id.includes('/')) return 'unknown'
  return /^(gpt-|o\d|chatgpt-)/i.test(id) ? 'openai' : 'anthropic'
}

/** The credential the model needs, or null when we cannot serve the model at all. */
export function requirementForModel(model: string): ProviderRequirement | null {
  const provider = providerForModel(model)
  return provider === 'unknown' ? null : { kind: 'env', envVar: PROVIDER_ENV_VAR_NAME[provider] }
}

/** How an operator satisfies a requirement, for embedding in a message. */
export function describeRequirement(requirement: ProviderRequirement): string {
  return requirement.envVar
}

/** Which env var name the given model's key needs — the name, not the value. */
export function envVarNameForModel(model: string): string | undefined {
  return requirementForModel(model)?.envVar
}

/** The API key the given model needs, read from an env-like record. */
export function apiKeyForModel(
  model: string,
  env: Record<string, string | undefined>,
): string | undefined {
  const name = envVarNameForModel(model)
  return name ? env[name] || undefined : undefined
}
