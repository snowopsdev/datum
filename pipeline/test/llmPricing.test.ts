import assert from 'node:assert/strict'
import test from 'node:test'

import { LLM_CATALOG } from '../../cms/src/lib/llmCatalog'
import { costUsd } from '../src/pricing'

// Anthropic list prices, USD per 1M tokens (https://platform.claude.com/docs/en/about-claude/pricing).
const ANTHROPIC_LIST_PRICES: Record<string, [number, number]> = {
  'claude-fable-5': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-sonnet-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
}

test('the catalog carries Anthropic list prices', () => {
  for (const [id, [input, output]] of Object.entries(ANTHROPIC_LIST_PRICES)) {
    const entry = LLM_CATALOG.find((model) => model.id === id)
    assert.ok(entry, id)
    assert.deepEqual([entry.input, entry.output], [input, output], id)
  }
  assert.equal(costUsd('claude-sonnet-5', 1_000_000, 1_000_000), 12)
})
