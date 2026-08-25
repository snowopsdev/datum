import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { apiKeyForModel, providerForModel } from '../src/llmProvider'

describe('providerForModel', () => {
  it('routes OpenAI model families to openai', () => {
    for (const model of ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'GPT-4o', 'o3', 'o4-mini', 'chatgpt-4o-latest']) {
      assert.equal(providerForModel(model), 'openai', model)
    }
  })

  it('routes everything else to anthropic', () => {
    for (const model of ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'some-future-model']) {
      assert.equal(providerForModel(model), 'anthropic', model)
    }
  })

  it('ignores surrounding whitespace', () => {
    assert.equal(providerForModel('  gpt-5 '), 'openai')
  })
})

describe('apiKeyForModel', () => {
  it('returns the key for the model provider and treats empty strings as unset', () => {
    const env = { ANTHROPIC_API_KEY: 'a-key', OPENAI_API_KEY: '' }
    assert.equal(apiKeyForModel('claude-opus-5', env), 'a-key')
    assert.equal(apiKeyForModel('gpt-5', env), undefined)
    assert.equal(apiKeyForModel('gpt-5', { OPENAI_API_KEY: 'o-key' }), 'o-key')
  })
})
