/** USD per 1M tokens, keyed by model id. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

const warnedModels = new Set<string>()

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model]
  if (!price) {
    if (!warnedModels.has(model)) {
      warnedModels.add(model)
      console.warn(`[pricing] unknown model "${model}" — recording cost as 0`)
    }
    return 0
  }
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
}
