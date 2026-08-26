import { describe, expect, it } from 'vitest'

import { CostLog } from '@/collections/CostLog'
import { LlmSettings } from '@/globals/LlmSettings'
import { LLM_MODEL_OPTIONS } from '@/lib/llmCatalog'
import { PIPELINE_STAGES, STAGE_SETTING_FIELD } from '@/lib/llmSettings'

describe('Models global', () => {
  it('exposes one clearable dropdown per pipeline stage plus brand-voice extraction', () => {
    const names = LlmSettings.fields.map((f) => ('name' in f ? f.name : ''))
    for (const stage of PIPELINE_STAGES) expect(names).toContain(STAGE_SETTING_FIELD[stage])
    expect(names).toContain('brandVoiceExtractModel')
    for (const field of LlmSettings.fields) {
      expect(field.type).toBe('select')
      if (field.type === 'select') {
        expect(field.options).toEqual([...LLM_MODEL_OPTIONS])
        expect(field.required).toBeFalsy()
        expect(field.admin?.isClearable).toBe(true)
      }
    }
  })

  it('is readable and editable only when authenticated', async () => {
    expect(await LlmSettings.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(await LlmSettings.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(true)
    expect(await LlmSettings.access?.update?.({ req: { user: null } } as never)).toBe(false)
    expect(await LlmSettings.access?.update?.({ req: { user: { id: 1 } } } as never)).toBe(true)
  })
})

describe('CostLog stage options', () => {
  it('includes every pipeline stage', () => {
    const stageField = CostLog.fields.find((f) => 'name' in f && f.name === 'stage')
    expect(stageField?.type).toBe('select')
    if (stageField?.type === 'select') {
      const options = stageField.options.map((o) => (typeof o === 'string' ? o : o.value))
      for (const stage of PIPELINE_STAGES) expect(options).toContain(stage)
    }
  })
})
