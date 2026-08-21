/** USD per 1M tokens, keyed by model id. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

/** Server-side web search tool, billed per invocation on top of tokens. */
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
