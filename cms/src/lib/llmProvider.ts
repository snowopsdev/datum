/**
 * Which API a model id belongs to. Shared by the pipeline (`llm.ts`) and the
 * CMS (brand-voice extraction) so both route the same way: the model id alone
 * decides the provider — no separate provider flag to keep in sync. A `codex/`
 * prefix routes to the local Codex CLI, which authenticates from its own login
 * rather than an env var.
 */
export type LlmProvider = 'anthropic' | 'openai' | 'codex'

/** The providers whose credential is an API key in the environment. */
export type ApiKeyProvider = Exclude<LlmProvider, 'codex'>

export const LLM_PROVIDERS: readonly LlmProvider[] = ['anthropic', 'openai', 'codex']

/**
 * Name of the env var each provider's key lives in — never the key value
 * itself. Named without "key"/"secret"/"token" so log lines built from it
 * (e.g. "set ANTHROPIC_API_KEY") don't pattern-match as credential logging.
 */
export const PROVIDER_ENV_VAR_NAME: Record<ApiKeyProvider, 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY'> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
}

/** What a model needs before it can run: a key in the environment, or a Codex CLI login. */
export type ProviderRequirement =
  | { kind: 'env'; envVar: 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' }
  | { kind: 'codex-login' }
  | { kind: 'codex-disabled' }

export const CODEX_MODEL_PREFIX = 'codex/'

/** `codex/*` → Codex; `gpt-*`, `o1`/`o3`/`o4-*`, `chatgpt-*` → OpenAI; everything else (`claude-*`) → Anthropic. */
export function providerForModel(model: string): LlmProvider {
  const id = model.trim()
  if (id.toLowerCase().startsWith(CODEX_MODEL_PREFIX)) return 'codex'
  return /^(gpt-|o\d|chatgpt-)/i.test(id) ? 'openai' : 'anthropic'
}

/** The underlying model id a `codex/` entry wraps. Other ids pass through unchanged. */
export function codexModelId(model: string): string {
  const id = model.trim()
  if (!id.toLowerCase().startsWith(CODEX_MODEL_PREFIX)) return model
  return id.slice(CODEX_MODEL_PREFIX.length).trim()
}

export function requirementForModel(model: string): ProviderRequirement {
  const provider = providerForModel(model)
  return provider === 'codex'
    ? { kind: 'codex-disabled' }
    : { kind: 'env', envVar: PROVIDER_ENV_VAR_NAME[provider] }
}

/** How an operator satisfies a requirement, for embedding in a message. */
export function describeRequirement(requirement: ProviderRequirement): string {
  if (requirement.kind === 'env') return requirement.envVar
  return requirement.kind === 'codex-login' ? '`codex login`' : 'an API-backed model'
}

/** Which env var name the given model's key needs — the name, not the value. Undefined for Codex. */
export function envVarNameForModel(model: string): string | undefined {
  const requirement = requirementForModel(model)
  return requirement.kind === 'env' ? requirement.envVar : undefined
}

/** The API key the given model needs, read from an env-like record. */
export function apiKeyForModel(
  model: string,
  env: Record<string, string | undefined>,
): string | undefined {
  const name = envVarNameForModel(model)
  return name ? env[name] || undefined : undefined
}
