import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { catalogModel, LLM_CATALOG, LLM_MODEL_OPTIONS } from '../../cms/src/lib/llmCatalog'
import { resolveExtractionModel, resolveModel, resolveStageModels } from '../../cms/src/lib/llmSettings'
import { providerForModel } from '../src/llmProvider'
import { costUsd } from '../src/pricing'

describe('resolveModel precedence', () => {
  it('prefers the admin setting, then the env override, then the default', () => {
    assert.deepEqual(resolveModel('gpt-5.6-terra', 'claude-sonnet-5'), {
      model: 'gpt-5.6-terra',
      source: 'admin',
    })
    assert.deepEqual(resolveModel('', 'claude-sonnet-5'), { model: 'claude-sonnet-5', source: 'env' })
    assert.deepEqual(resolveModel(null, undefined), { model: 'claude-opus-5', source: 'default' })
    assert.deepEqual(resolveModel('  ', '  '), { model: 'claude-opus-5', source: 'default' })
  })

  it('resolves every pipeline stage independently', () => {
    const resolved = resolveStageModels(
      { generateModel: 'gpt-5.6-sol', factCheckModel: null },
      { PIPELINE_MODEL_FACT_CHECK: 'claude-sonnet-5' },
    )
    assert.equal(resolved.generate.model, 'gpt-5.6-sol')
    assert.equal(resolved.generate.source, 'admin')
    assert.equal(resolved.factCheck.model, 'claude-sonnet-5')
    assert.equal(resolved.factCheck.source, 'env')
    assert.equal(resolved.qualitativeReview.model, 'claude-opus-5')
    assert.equal(resolved.qualitativeReview.source, 'default')
  })

  it('resolves claimExtraction from its env override', () => {
    const resolved = resolveStageModels(null, {
      PIPELINE_MODEL_CLAIM_EXTRACTION: 'claude-sonnet-5',
    })
    assert.equal(resolved.claimExtraction.model, 'claude-sonnet-5')
    assert.equal(resolved.claimExtraction.source, 'env')
  })

  it('resolves the brand-voice extraction model the same way', () => {
    assert.equal(resolveExtractionModel({ brandVoiceExtractModel: 'gpt-5.6-luna' }, {}).model, 'gpt-5.6-luna')
    assert.equal(resolveExtractionModel(null, { BRAND_VOICE_EXTRACT_MODEL: 'gpt-5' }).model, 'gpt-5')
    assert.equal(resolveExtractionModel(null, {}).model, 'claude-opus-5')
  })
})

describe('model catalog', () => {
  it('routes every catalog entry to the provider it declares', () => {
    for (const model of LLM_CATALOG) {
      assert.equal(providerForModel(model.id), model.provider, model.id)
    }
  })

  it('prices every catalog entry so cost logging never falls back to $0', () => {
    for (const model of LLM_CATALOG) {
      assert.equal(costUsd(model.id, 1_000_000, 1_000_000), model.input + model.output, model.id)
    }
  })

  it('offers the OpenAI flagship trio and the default Claude model in the dropdown', () => {
    const values = LLM_MODEL_OPTIONS.map((o) => o.value)
    for (const id of ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'claude-opus-5']) {
      assert.ok(values.includes(id), id)
    }
    assert.match(catalogModel('gpt-5.6-terra')?.label ?? '', /GPT-5\.6 Terra/)
    assert.match(LLM_MODEL_OPTIONS.find((o) => o.value === 'gpt-5.6-terra')?.label ?? '', /\$2 in \/ \$12 out/)
  })
})
