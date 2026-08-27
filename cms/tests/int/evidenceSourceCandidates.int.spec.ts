import { describe, expect, it } from 'vitest'

import { EvidenceSourceCandidates } from '@/collections/EvidenceSourceCandidates'
import { CANDIDATE_CLASSES } from '@/lib/informationGain'

const beforeValidate = EvidenceSourceCandidates.hooks?.beforeValidate?.[0]

const field = (name: string) =>
  EvidenceSourceCandidates.fields.find((f) => 'name' in f && f.name === name)

describe('evidence source candidates collection', () => {
  it('normalises the domain the same way evidence sources does', async () => {
    const data = { domain: 'https://WWW.Example.com/path' }
    await beforeValidate?.({ data } as never)
    expect(data.domain).toBe('example.com')
  })

  it('rejects a domain that normalises to nothing', () => {
    expect(() => beforeValidate?.({ data: { domain: '  ' } } as never)).toThrow('domain is required')
  })

  it('leaves a partial update without a domain alone', async () => {
    const data = { status: 'dismissed' }
    await beforeValidate?.({ data } as never)
    expect(data).toEqual({ status: 'dismissed' })
  })

  it('keys one row per domain', () => {
    const domain = field('domain')
    expect(domain?.type).toBe('text')
    if (domain?.type === 'text') {
      expect(domain.required).toBe(true)
      expect(domain.unique).toBe(true)
      expect(domain.index).toBe(true)
    }
  })

  it('starts a candidate pending', () => {
    const status = field('status')
    expect(status?.type).toBe('select')
    if (status?.type === 'select') {
      expect(status.options).toEqual(['pending', 'approved', 'dismissed'])
      expect(status.defaultValue).toBe('pending')
      expect(status.required).toBe(true)
    }
  })

  // The suggestion is a dropdown default, so it must never reach a class that
  // could clear a novel-claim floor on its own, nor one only a human can grant.
  it('cannot suggest first_party_dataset or blocked', () => {
    const suggested = field('suggestedClass')
    expect(suggested?.type).toBe('select')
    if (suggested?.type === 'select') {
      expect(suggested.options).toEqual([...CANDIDATE_CLASSES])
      expect(suggested.options).not.toContain('first_party_dataset')
      expect(suggested.options).not.toContain('blocked')
    }
  })

  it('points at the rule it became', () => {
    const resolved = field('resolvedSource')
    expect(resolved?.type).toBe('relationship')
    if (resolved?.type === 'relationship') {
      expect(resolved.relationTo).toBe('evidence-sources')
      expect(resolved.maxDepth).toBe(0)
    }
  })

  it('is pipeline-written: readable when signed in, never writable through the API', async () => {
    expect(
      await EvidenceSourceCandidates.access?.read?.({ req: { user: { id: 1 } } } as never),
    ).toBe(true)
    expect(await EvidenceSourceCandidates.access?.read?.({ req: { user: null } } as never)).toBe(
      false,
    )
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(
        await EvidenceSourceCandidates.access?.[operation]?.({
          req: { user: { id: 1 } },
        } as never),
      ).toBe(false)
    }
  })
})
