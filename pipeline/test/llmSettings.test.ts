import {resolveTopicRelevanceModel} from '../../cms/src/lib/llmSettings'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { LLM_CATALOG, LLM_MODEL_OPTIONS } from '../../cms/src/lib/llmCatalog'
import {
  PIPELINE_STAGES,
  resolveExtractionModel,
  resolveModel,
  resolveSetupAssistModel,
  resolveStageModels,
  STAGE_ENV_VAR,
  STAGE_SETTING_FIELD,
} from '../../cms/src/lib/llmSettings'
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
    assert.ok(PIPELINE_STAGES.includes('briefAngle'))
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
    assert.match(LLM_MODEL_OPTIONS.find((o) => o.value === 'gpt-5.6-terra')?.label ?? '', /\$2 in \/ \$12 out/)
  })

  it('offers no vendor-namespaced entry the API cannot serve', () => {
    assert.deepEqual(LLM_CATALOG.filter((m) => m.id.includes('/')), [])
    assert.deepEqual(LLM_MODEL_OPTIONS.filter((o) => o.value.includes('/')), [])
  })
})

it('topic relevance is CMS-only and resolves admin, environment, then default', () => {
  assert.equal(resolveTopicRelevanceModel({topicRelevanceModel:'gpt-5.4-mini'},{TOPIC_RELEVANCE_MODEL:'gpt-5'}).model,'gpt-5.4-mini')
  assert.equal(resolveTopicRelevanceModel(null,{TOPIC_RELEVANCE_MODEL:'gpt-5'}).model,'gpt-5')
  assert.equal(resolveTopicRelevanceModel(null,{}).source,'default')
  assert.ok(!(PIPELINE_STAGES as readonly string[]).includes('topicRelevance'))
})

/**
 * The two short structured calls — brief angles and topic fit — say a small
 * model is enough, so unset they must not inherit flagship pricing. They take
 * the small model of whichever provider the workspace writes with, so a
 * workspace on one provider is never blocked for the other's key.
 */
it('brief angles and topic fit default to the small model of the writer\'s provider', () => {
  assert.deepEqual(resolveStageModels(null, {}).briefAngle, { model: 'claude-haiku-4-5', source: 'default' })
  assert.deepEqual(resolveTopicRelevanceModel(null, {}), { model: 'claude-haiku-4-5', source: 'default' })
  const openai = { generateModel: 'gpt-5.6-sol' }
  assert.equal(resolveStageModels(openai, {}).briefAngle.model, 'gpt-5.4-mini')
  assert.equal(resolveTopicRelevanceModel(openai, {}).model, 'gpt-5.4-mini')
  assert.equal(resolveStageModels(null, { PIPELINE_MODEL_GENERATE: 'gpt-5.6-terra' }).briefAngle.model, 'gpt-5.4-mini')
  // Everything else keeps the platform default.
  assert.equal(resolveStageModels(null, {}).qualitativeReview.model, 'claude-opus-5')
  // And an explicit choice always wins.
  assert.equal(resolveStageModels({ briefAngleModel: 'claude-sonnet-5' }, {}).briefAngle.model, 'claude-sonnet-5')
})
it('the small defaults are real catalog models', () => {
  for (const id of ['claude-haiku-4-5', 'gpt-5.4-mini']) assert.ok(LLM_CATALOG.some((m) => m.id === id), id)
})
