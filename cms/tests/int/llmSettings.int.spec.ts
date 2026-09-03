import { describe, expect, it } from 'vitest'

import { CostLog } from '@/collections/CostLog'
import { LlmSettings } from '@/globals/LlmSettings'
import { LLM_MODEL_OPTIONS } from '@/lib/llmCatalog'
import { PIPELINE_STAGES, STAGE_SETTING_FIELD } from '@/lib/llmSettings'

describe('Models global', () => {
  it('exposes one clearable dropdown per pipeline stage plus the two CMS-side calls', () => {
    const names = LlmSettings.fields.map((f) => ('name' in f ? f.name : ''))
    for (const stage of PIPELINE_STAGES) expect(names).toContain(STAGE_SETTING_FIELD[stage])
    expect(names).toContain('evidenceCheckModel')
    expect(names).toContain('brandVoiceExtractModel')
    expect(names).toContain('setupAssistModel')
    for (const field of LlmSettings.fields) {
      expect(field.type).toBe('select')
      if (field.type === 'select') {
        expect(field.options).toEqual([...LLM_MODEL_OPTIONS])
        expect(field.required).toBeFalsy()
        expect(field.admin?.isClearable).toBe(true)
      }
    }
  })

  it('names the environment variable behind each new slot', () => {
    const description = (name: string) => {
      const field = LlmSettings.fields.find((f) => 'name' in f && f.name === name)
      const admin = field && 'admin' in field ? (field.admin as { description?: string }) : undefined
      return admin?.description ?? ''
    }
    expect(description('evidenceCheckModel')).toContain('PIPELINE_MODEL_EVIDENCE_CHECK')
    expect(description('evidenceCheckModel')).toContain('evidence bank')
    expect(description('setupAssistModel')).toContain('SETUP_ASSIST_MODEL')
  })

  it('is readable and editable only when authenticated', async () => {
    expect(await LlmSettings.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(await LlmSettings.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(true)
    expect(await LlmSettings.access?.update?.({ req: { user: null } } as never)).toBe(false)
    expect(await LlmSettings.access?.update?.({ req: { user: { id: 1 } } } as never)).toBe(true)
  })
})

describe('CostLog stage options', () => {
  it('includes every pipeline stage and every CMS-side call', () => {
    const stageField = CostLog.fields.find((f) => 'name' in f && f.name === 'stage')
    expect(stageField?.type).toBe('select')
    if (stageField?.type === 'select') {
      const options = stageField.options.map((o) => (typeof o === 'string' ? o : o.value))
      for (const stage of PIPELINE_STAGES) expect(options).toContain(stage)
      // A cost row naming a stage the enum does not carry fails the insert, so
      // the CMS-side calls have to be listed here even though they are not
      // pipeline stages.
      expect(options).toContain('brandVoiceExtract')
      expect(options).toContain('setupAssist')
    }
  })
})
