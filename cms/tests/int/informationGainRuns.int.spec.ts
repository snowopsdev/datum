import { describe, expect, it } from 'vitest'

import { InformationGainRuns } from '@/collections/InformationGainRuns'

import type { Field } from 'payload'

const findField = (fields: Field[], name: string): Field | undefined =>
  fields.find((f) => 'name' in f && f.name === name)

const topLevelFields: Array<{ name: string; type: string }> = [
  { name: 'article', type: 'relationship' },
  { name: 'pipelineRunId', type: 'text' },
  { name: 'snapshot', type: 'relationship' },
  { name: 'policyVersion', type: 'text' },
  { name: 'policy', type: 'json' },
  { name: 'models', type: 'json' },
  { name: 'decision', type: 'select' },
  { name: 'reasons', type: 'json' },
  { name: 'baselineAvailable', type: 'checkbox' },
  { name: 'calibrated', type: 'checkbox' },
  { name: 'scores', type: 'group' },
  { name: 'claimSummary', type: 'group' },
  { name: 'claimIds', type: 'group' },
  { name: 'claims', type: 'json' },
  { name: 'tokenCount', type: 'number' },
  { name: 'costUsd', type: 'number' },
  { name: 'draftUpdatedAt', type: 'date' },
]

const scoresSubfields = [
  'consensusCoverage',
  'potentialGainUnits',
  'verifiedGainUnits',
  'verificationRatio',
  'verifiedGainDensity',
  'facetGainCoverage',
  'internalDuplicationRate',
]

const claimSummarySubfields = [
  'totalClaims',
  'materiallyNovelClaims',
  'verifiedNovelClaims',
  'unsupportedNovelClaims',
  'contradictoryClaims',
  'firstPartyClaims',
]

const claimIdsSubfields = ['blocked', 'review', 'materiallyNovel', 'verifiedNovel']

describe('information-gain-runs collection', () => {
  it('has slug information-gain-runs and expected admin config', () => {
    expect(InformationGainRuns.slug).toBe('information-gain-runs')
    expect(InformationGainRuns.admin?.useAsTitle).toBe('decision')
    expect(InformationGainRuns.admin?.defaultColumns).toEqual([
      'createdAt',
      'article',
      'decision',
      'policyVersion',
    ])
    expect(InformationGainRuns.admin?.group).toBe(false)
    expect(InformationGainRuns.timestamps).toBe(true)
  })

  it('has every top-level field with the right name and type, in order', () => {
    const names = InformationGainRuns.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(topLevelFields.map((f) => f.name))

    for (const def of topLevelFields) {
      const field = findField(InformationGainRuns.fields, def.name)
      expect(field?.type).toBe(def.type)
    }
  })

  it('marks article, pipelineRunId, decision as required and indexed', () => {
    for (const name of ['article', 'pipelineRunId', 'decision']) {
      const field = findField(InformationGainRuns.fields, name)
      expect(field && 'required' in field ? field.required : undefined).toBe(true)
      expect(field && 'index' in field ? field.index : undefined).toBe(true)
    }
  })

  it('marks policyVersion as required (not indexed)', () => {
    const field = findField(InformationGainRuns.fields, 'policyVersion')
    expect(field?.type === 'text' ? field.required : undefined).toBe(true)
  })

  it('points article at articles', () => {
    const field = findField(InformationGainRuns.fields, 'article')
    expect(field?.type).toBe('relationship')
    if (field?.type === 'relationship') {
      expect(field.relationTo).toBe('articles')
    }
  })

  it('points snapshot at corpus-snapshots with maxDepth 0', () => {
    const field = findField(InformationGainRuns.fields, 'snapshot')
    expect(field?.type).toBe('relationship')
    if (field?.type === 'relationship') {
      expect(field.relationTo).toBe('corpus-snapshots')
      expect(field.maxDepth).toBe(0)
    }
  })

  it('offers the four decision options', () => {
    const field = findField(InformationGainRuns.fields, 'decision')
    expect(field?.type).toBe('select')
    if (field?.type === 'select') {
      expect(field.options).toEqual(['PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK'])
    }
  })

  it('defaults calibrated to false, read-only, with an uncalibrated-signals description', () => {
    const field = findField(InformationGainRuns.fields, 'calibrated')
    expect(field?.type).toBe('checkbox')
    if (field?.type === 'checkbox') {
      expect(field.defaultValue).toBe(false)
      expect(field.admin?.readOnly).toBe(true)
      expect(field.admin?.description).toContain('uncalibrated LLM estimate')
    }
  })

  it('has a scores group with the expected number subfields', () => {
    const field = findField(InformationGainRuns.fields, 'scores')
    expect(field?.type).toBe('group')
    if (field?.type !== 'group') return

    const names = field.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(scoresSubfields)
    for (const name of scoresSubfields) {
      expect(findField(field.fields, name)?.type).toBe('number')
    }
  })

  it('has a claimSummary group with the expected number subfields', () => {
    const field = findField(InformationGainRuns.fields, 'claimSummary')
    expect(field?.type).toBe('group')
    if (field?.type !== 'group') return

    const names = field.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(claimSummarySubfields)
    for (const name of claimSummarySubfields) {
      expect(findField(field.fields, name)?.type).toBe('number')
    }
  })

  it('has a claimIds group with a json field per DocumentScore claim-id list', () => {
    const field = findField(InformationGainRuns.fields, 'claimIds')
    expect(field?.type).toBe('group')
    if (field?.type !== 'group') return

    const names = field.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(claimIdsSubfields)
    for (const name of claimIdsSubfields) {
      expect(findField(field.fields, name)?.type).toBe('json')
    }

    expect(field.admin?.description).toContain('not re-derivable once the policy changes')
  })

  it('is readable only when authenticated, and never writable through the admin API', async () => {
    expect(await InformationGainRuns.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(
      await InformationGainRuns.access?.read?.({ req: { user: { id: 1 } } } as never),
    ).toBe(true)

    expect(await InformationGainRuns.access?.create?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
    expect(await InformationGainRuns.access?.update?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
    expect(await InformationGainRuns.access?.delete?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
  })

  it('rejects updates and deletes even when collection access is bypassed', () => {
    const beforeChange = InformationGainRuns.hooks?.beforeChange?.[0]
    const beforeDelete = InformationGainRuns.hooks?.beforeDelete?.[0]

    expect(() => beforeChange?.({ operation: 'update' } as never)).toThrow('append-only')
    expect(beforeChange?.({ operation: 'create' } as never)).toBeUndefined()
    expect(() => beforeDelete?.({} as never)).toThrow('append-only')
  })
})
