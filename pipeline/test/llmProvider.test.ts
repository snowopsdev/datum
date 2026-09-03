import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  apiKeyForModel,
  codexModelId,
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

  it('routes prefixed ids to codex regardless of case or whitespace', () => {
    for (const model of ['codex/gpt-5.6-terra', 'CODEX/gpt-5', '  codex/gpt-5  ']) {
      assert.equal(providerForModel(model), 'codex', model)
    }
  })

  it('treats a bare codex id as an unknown model', () => {
    assert.equal(providerForModel('codex'), 'anthropic')
  })
})

describe('codexModelId', () => {
  it('strips the prefix and trims the remainder', () => {
    assert.equal(codexModelId('codex/gpt-5.6-terra'), 'gpt-5.6-terra')
    assert.equal(codexModelId('CODEX/gpt-5'), 'gpt-5')
    assert.equal(codexModelId('  codex/gpt-5  '), 'gpt-5')
  })

  it('passes non-codex ids through unchanged', () => {
    assert.equal(codexModelId('gpt-5'), 'gpt-5')
    assert.equal(codexModelId('claude-opus-5'), 'claude-opus-5')
    assert.equal(codexModelId('codex'), 'codex')
  })
})

describe('requirementForModel', () => {
  it('reports the env var for key providers and disables live codex', () => {
    assert.deepEqual(requirementForModel('claude-opus-5'), { kind: 'env', envVar: 'ANTHROPIC_API_KEY' })
    assert.deepEqual(requirementForModel('gpt-5'), { kind: 'env', envVar: 'OPENAI_API_KEY' })
    assert.deepEqual(requirementForModel('codex/gpt-5'), { kind: 'codex-disabled' })
  })
})

describe('describeRequirement', () => {
  it('names the env var, login command, or safe replacement', () => {
    assert.equal(describeRequirement({ kind: 'env', envVar: 'ANTHROPIC_API_KEY' }), 'ANTHROPIC_API_KEY')
    assert.equal(describeRequirement({ kind: 'env', envVar: 'OPENAI_API_KEY' }), 'OPENAI_API_KEY')
    assert.equal(describeRequirement({ kind: 'codex-login' }), '`codex login`')
    assert.equal(describeRequirement({ kind: 'codex-disabled' }), 'an API-backed model')
  })
})

describe('envVarNameForModel', () => {
  it('names the key provider var and leaves codex undefined', () => {
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

  it('returns undefined for codex models, which carry no key', () => {
    assert.equal(apiKeyForModel('codex/gpt-5', { OPENAI_API_KEY: 'k' }), undefined)
  })
})
