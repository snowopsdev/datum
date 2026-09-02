import { CODEX_MODEL_PREFIX, type LlmProvider } from './llmProvider'

/**
 * Models operators can pick in the admin (Models global). One source of truth
 * for the dropdowns and for `pricing.ts`. Prices are USD per 1M tokens.
 *
 * OpenAI entries are the "Flagship models" section of
 * https://developers.openai.com/api/docs/pricing (pro/cyber tiers omitted).
 */
export interface LlmModel {
  id: string
  label: string
  provider: LlmProvider
  input: number
  output: number
  note: string
}

export const DEFAULT_MODEL = 'claude-opus-5'

const BASE_CATALOG: readonly LlmModel[] = [
  // Anthropic — Claude 5 family
  { id: 'claude-fable-5', label: 'Claude Fable 5', provider: 'anthropic', input: 10, output: 50, note: 'Most capable' },
  { id: 'claude-opus-5', label: 'Claude Opus 5', provider: 'anthropic', input: 5, output: 25, note: 'Default; strong long-form writing' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'anthropic', input: 3, output: 15, note: 'Balanced' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', provider: 'anthropic', input: 1, output: 5, note: 'Fast and cheap' },
  // OpenAI — flagship models
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', provider: 'openai', input: 4, output: 20, note: 'Frontier model for complex work' },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', provider: 'openai', input: 2, output: 12, note: 'Balances intelligence and cost' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', provider: 'openai', input: 0.2, output: 1.2, note: 'Cost-sensitive workloads' },
  { id: 'gpt-5.5', label: 'GPT-5.5', provider: 'openai', input: 5, output: 30, note: 'Previous frontier' },
  { id: 'gpt-5.4', label: 'GPT-5.4', provider: 'openai', input: 2.5, output: 15, note: '' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', provider: 'openai', input: 0.75, output: 4.5, note: '' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', provider: 'openai', input: 0.2, output: 1.25, note: '' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'openai', input: 1.25, output: 10, note: '' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', provider: 'openai', input: 0.25, output: 2, note: '' },
  { id: 'gpt-5-nano', label: 'GPT-5 nano', provider: 'openai', input: 0.05, output: 0.4, note: '' },
]

/**
 * The subset of `BASE_CATALOG` the ChatGPT plan actually serves through Codex,
 * read from the `models` slugs in `~/.codex/models_cache.json`. It is narrower
 * than the API catalog and moves independently of it, so re-check against a
 * live cache before editing this list.
 */
export const CODEX_MIRRORED_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
] as const

function codexMirror(id: string): LlmModel {
  const base = BASE_CATALOG.find((m) => m.id === id)
  if (!base) throw new Error(`CODEX_MIRRORED_MODELS lists "${id}", which is not in the catalog`)
  return {
    ...base,
    id: `${CODEX_MODEL_PREFIX}${base.id}`,
    provider: 'codex',
    label: `${base.label} via Codex`,
    note: 'Estimated at API rates; billed to your ChatGPT plan',
  }
}

export const LLM_CATALOG: readonly LlmModel[] = [
  ...BASE_CATALOG,
  ...CODEX_MIRRORED_MODELS.map(codexMirror),
]

const PROVIDER_LABEL: Record<LlmProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  codex: 'Codex (ChatGPT plan)',
}

const money = (n: number): string => `$${n % 1 === 0 ? n.toFixed(0) : n.toString()}`

/** Dropdown options for the Models global: "GPT-5.6 Terra · OpenAI · $2 in / $12 out per 1M — Balances…". */
export const LLM_MODEL_OPTIONS: readonly { label: string; value: string }[] = LLM_CATALOG.map((m) => ({
  value: m.id,
  label: `${m.label} · ${PROVIDER_LABEL[m.provider]} · ${money(m.input)} in / ${money(m.output)} out per 1M${
    m.note ? ` — ${m.note}` : ''
  }`,
}))

export function catalogModel(id: string): LlmModel | undefined {
  return LLM_CATALOG.find((m) => m.id === id)
}
