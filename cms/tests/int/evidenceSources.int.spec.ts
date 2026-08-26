import { describe, expect, it } from 'vitest'

import { EvidenceSources } from '@/collections/EvidenceSources'
import { SOURCE_QUALITY_CLASSES } from '@/lib/informationGain'

const beforeValidate = EvidenceSources.hooks?.beforeValidate?.[0]

describe('evidence sources collection', () => {
  it('normalises the domain before validation', async () => {
    const data = { domain: 'https://WWW.Example.com/path', qualityClass: 'primary' }
    await beforeValidate?.({ data } as never)
    expect(data.domain).toBe('example.com')
  })

  it('rejects a domain that normalises to nothing', () => {
    expect(() => beforeValidate?.({ data: { domain: '   ' } } as never)).toThrow(
      'domain is required',
    )
  })

  it('leaves a partial update without a domain alone', async () => {
    const data = { active: false }
    await beforeValidate?.({ data } as never)
    expect(data).toEqual({ active: false })
  })

  it('offers exactly the shared quality classes', () => {
    const field = EvidenceSources.fields.find((f) => 'name' in f && f.name === 'qualityClass')
    expect(field?.type).toBe('select')
    if (field?.type === 'select') {
      expect(field.options).toEqual([...SOURCE_QUALITY_CLASSES])
      expect(field.required).toBe(true)
    }
  })

  it('is readable and writable only when authenticated', async () => {
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      expect(await EvidenceSources.access?.[operation]?.({ req: { user: null } } as never)).toBe(
        false,
      )
      expect(
        await EvidenceSources.access?.[operation]?.({ req: { user: { id: 1 } } } as never),
      ).toBe(true)
    }
  })

  it('audits every change', () => {
    expect(typeof EvidenceSources.hooks?.afterChange?.[0]).toBe('function')
  })
})
