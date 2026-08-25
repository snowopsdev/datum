/**
 * LLM pricing. Lives in the CMS lib so both the pipeline (via
 * `pipeline/src/pricing.ts`) and CMS-side calls such as brand-voice
 * extraction compute `costUsd` the same way.
 */
import { LLM_CATALOG } from './llmCatalog'

/** Models no longer offered in the admin dropdown but still priced so old env overrides log cost. */
const LEGACY_PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  o3: { input: 2, output: 8 },
  'o4-mini': { input: 1.1, output: 4.4 },
}

/** USD per 1M tokens, keyed by model id. The catalog is the source of truth for selectable models. */
const PRICES: Record<string, { input: number; output: number }> = {
  ...LEGACY_PRICES,
  ...Object.fromEntries(LLM_CATALOG.map((m) => [m.id, { input: m.input, output: m.output }])),
}

/**
 * Server-side web search tool, billed per invocation on top of tokens. Both
 * Anthropic and OpenAI currently list $10 per 1,000 calls.
 */
const WEB_SEARCH_USD_PER_1000 = 10

const warnedModels = new Set<string>()

export function costUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  webSearchRequests = 0,
): number {
  const searchCost = (webSearchRequests / 1000) * WEB_SEARCH_USD_PER_1000
  const price = PRICES[model]
  if (!price) {
    if (!warnedModels.has(model)) {
      warnedModels.add(model)
      console.warn(`[pricing] unknown model "${model}" — recording token cost as 0`)
    }
    return searchCost
  }
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output +
    searchCost
  )
}
