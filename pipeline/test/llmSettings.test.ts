import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  catalogModel,
  CODEX_MIRRORED_MODELS,
  LLM_CATALOG,
  LLM_MODEL_OPTIONS,
} from '../../cms/src/lib/llmCatalog'
import {
  PIPELINE_STAGES,
  resolveExtractionModel,
  resolveModel,
  resolveSetupAssistModel,
  resolveStageModels,
  STAGE_ENV_VAR,
  STAGE_SETTING_FIELD,
} from '../../cms/src/lib/llmSettings'
import { codexModelId, providerForModel } from '../src/llmProvider'
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

  it('resolves the evidence check from its own admin field and env override', () => {
    assert.equal(
      resolveStageModels({ evidenceCheckModel: 'claude-haiku-4-5' }, {}).evidenceCheck.model,
      'claude-haiku-4-5',
    )
    const fromEnv = resolveStageModels(null, { PIPELINE_MODEL_EVIDENCE_CHECK: 'gpt-5.4-mini' })
      .evidenceCheck
    assert.equal(fromEnv.model, 'gpt-5.4-mini')
    assert.equal(fromEnv.source, 'env')
    // The QA sibling is untouched: the two calls are priced and chosen apart.
    assert.equal(resolveStageModels(null, { PIPELINE_MODEL_EVIDENCE_CHECK: 'gpt-5.4-mini' }).factCheck.model, 'claude-opus-5')
  })

  it('gives every stage its own env var and settings field, with no collisions', () => {
    const envVars = PIPELINE_STAGES.map((stage) => STAGE_ENV_VAR[stage])
    const fields = PIPELINE_STAGES.map((stage) => STAGE_SETTING_FIELD[stage])
    assert.equal(new Set(envVars).size, PIPELINE_STAGES.length)
    assert.equal(new Set(fields).size, PIPELINE_STAGES.length)
    assert.ok(PIPELINE_STAGES.includes('evidenceCheck'))
  })

  it('resolves the brand-voice extraction model the same way', () => {
    assert.equal(resolveExtractionModel({ brandVoiceExtractModel: 'gpt-5.6-luna' }, {}).model, 'gpt-5.6-luna')
    assert.equal(resolveExtractionModel(null, { BRAND_VOICE_EXTRACT_MODEL: 'gpt-5' }).model, 'gpt-5')
    assert.equal(resolveExtractionModel(null, {}).model, 'claude-opus-5')
  })

  /**
   * The setup assistant borrows the brand-voice extractor's model before the
   * platform default: both read a workspace's own words back to it, and a
   * workspace that has picked a cheap model for one must not silently pay
   * flagship prices for the other.
   */
  it('resolves the setup assistant through its own field, then the extractor, then the default', () => {
    assert.deepEqual(
      resolveSetupAssistModel({ setupAssistModel: 'gpt-5.4-mini' }, { SETUP_ASSIST_MODEL: 'gpt-5' }),
      { model: 'gpt-5.4-mini', source: 'admin' },
    )
    assert.deepEqual(resolveSetupAssistModel(null, { SETUP_ASSIST_MODEL: 'gpt-5' }), {
      model: 'gpt-5',
      source: 'env',
    })
    assert.deepEqual(resolveSetupAssistModel({ brandVoiceExtractModel: 'claude-haiku-4-5' }, {}), {
      model: 'claude-haiku-4-5',
      source: 'admin',
    })
    assert.deepEqual(resolveSetupAssistModel(null, { BRAND_VOICE_EXTRACT_MODEL: 'gpt-5-mini' }), {
      model: 'gpt-5-mini',
      source: 'env',
    })
    assert.deepEqual(resolveSetupAssistModel(null, {}), {
      model: 'claude-opus-5',
      source: 'default',
    })
    // Its own env var beats the extractor's admin choice: the more specific
    // answer wins wherever both are given.
    assert.equal(
      resolveSetupAssistModel({ brandVoiceExtractModel: 'claude-haiku-4-5' }, {
        SETUP_ASSIST_MODEL: 'gpt-5',
      }).model,
      'gpt-5',
    )
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

  it('prices every Codex entry exactly as the model it mirrors', () => {
    for (const model of LLM_CATALOG.filter((m) => m.provider === 'codex')) {
      const base = catalogModel(codexModelId(model.id))
      assert.ok(base, model.id)
      assert.equal(model.input, base.input, model.id)
      assert.equal(model.output, base.output, model.id)
    }
  })

  it('mirrors exactly the models the ChatGPT plan serves', () => {
    const mirrored = LLM_CATALOG.filter((m) => m.provider === 'codex').map((m) => codexModelId(m.id))
    assert.deepEqual([...mirrored].sort(), [...CODEX_MIRRORED_MODELS].sort())
  })

  it('leaves models the ChatGPT plan does not serve unmirrored', () => {
    for (const id of ['gpt-5.4-nano', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano']) {
      assert.ok(catalogModel(id), id)
      assert.equal(catalogModel(`codex/${id}`), undefined, id)
    }
  })

  it('offers a Codex entry in the dropdown labelled with its provider', () => {
    const option = LLM_MODEL_OPTIONS.find((o) => o.value === 'codex/gpt-5.6-terra')
    assert.ok(option)
    assert.match(option.label, /Codex \(ChatGPT plan\)/)
  })
})
