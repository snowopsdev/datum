import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  apiKeyForModel,
  describeRequirement,
  envVarNameForModel,
  providerForModel,
  requirementForModel,
} from '../src/llmProvider'

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

  it('codex ids are unknown providers with no requirement', () => {
    assert.equal(providerForModel('codex/gpt-5.4'), 'unknown')
    assert.equal(requirementForModel('codex/gpt-5.4'), null)
  })

  it('treats any vendor-namespaced id as unknown, whatever its case or spacing', () => {
    for (const model of ['CODEX/gpt-5', '  codex/gpt-5  ', 'vendor/whatever']) {
      assert.equal(providerForModel(model), 'unknown', model)
    }
  })

  it('treats a bare codex id as an ordinary unknown-family model', () => {
    assert.equal(providerForModel('codex'), 'anthropic')
  })
})

describe('requirementForModel', () => {
  it('reports the env var for key providers and nothing for a model we cannot serve', () => {
    assert.deepEqual(requirementForModel('claude-opus-5'), { kind: 'env', envVar: 'ANTHROPIC_API_KEY' })
    assert.deepEqual(requirementForModel('gpt-5'), { kind: 'env', envVar: 'OPENAI_API_KEY' })
    assert.equal(requirementForModel('codex/gpt-5'), null)
  })
})

describe('describeRequirement', () => {
  it('names the env var', () => {
    assert.equal(describeRequirement({ kind: 'env', envVar: 'ANTHROPIC_API_KEY' }), 'ANTHROPIC_API_KEY')
    assert.equal(describeRequirement({ kind: 'env', envVar: 'OPENAI_API_KEY' }), 'OPENAI_API_KEY')
  })
})

describe('envVarNameForModel', () => {
  it('names the key provider var and leaves an unservable model undefined', () => {
    assert.equal(envVarNameForModel('claude-opus-5'), 'ANTHROPIC_API_KEY')
    assert.equal(envVarNameForModel('gpt-5'), 'OPENAI_API_KEY')
    assert.equal(envVarNameForModel('codex/gpt-5'), undefined)
  })
})

describe('apiKeyForModel', () => {
  it('returns the key for the model provider and treats empty strings as unset', () => {
    const env = { ANTHROPIC_API_KEY: 'a-key', OPENAI_API_KEY: '' }
    assert.equal(apiKeyForModel('claude-opus-5', env), 'a-key')
    assert.equal(apiKeyForModel('gpt-5', env), undefined)
    assert.equal(apiKeyForModel('gpt-5', { OPENAI_API_KEY: 'o-key' }), 'o-key')
  })

  it('returns undefined for a model we cannot serve, which carries no key', () => {
    assert.equal(apiKeyForModel('codex/gpt-5', { OPENAI_API_KEY: 'k' }), undefined)
  })
})
