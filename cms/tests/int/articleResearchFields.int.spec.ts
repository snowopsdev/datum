import { describe, expect, it } from 'vitest'

import { Articles } from '@/collections/Articles'

import type { Field } from 'payload'

const findField = (fields: Field[], name: string): Field | undefined =>
  fields.find((f) => 'name' in f && f.name === name)

describe('articles research fields', () => {
  const research = findField(Articles.fields, 'research')
  if (research?.type !== 'group') {
    throw new Error('expected articles.research to be a group field')
  }

  it('adds the four information-gain research subfields with the right types', () => {
    const expected: Array<{ name: string; type: string }> = [
      { name: 'snapshot', type: 'relationship' },
      { name: 'queryCluster', type: 'json' },
      { name: 'facets', type: 'json' },
      { name: 'gaps', type: 'json' },
    ]

    for (const def of expected) {
      const field = findField(research.fields, def.name)
      expect(field?.type).toBe(def.type)
    }
  })

  it('points research.snapshot at corpus-snapshots', () => {
    const field = findField(research.fields, 'snapshot')
    expect(field?.type).toBe('relationship')
    if (field?.type === 'relationship') {
      expect(field.relationTo).toBe('corpus-snapshots')
      // Never hydrated by a depth-1 query: a snapshot carries every crawled
      // page's text, and no pipeline stage reads it off the article.
      expect(field.maxDepth).toBe(0)
    }
  })

  it('describes the research subfields as written by the research stage', () => {
    for (const name of ['snapshot', 'queryCluster', 'facets', 'gaps']) {
      const field = findField(research.fields, name)
      const description =
        field?.type === 'relationship' || field?.type === 'json'
          ? field.admin?.description
          : undefined
      expect(description).toBe('Written by the research stage; see docs/information-gain.md.')
    }
  })

  it('adds top-level revisionNotes and revisionCount fields', () => {
    const revisionNotes = findField(Articles.fields, 'revisionNotes')
    expect(revisionNotes?.type).toBe('textarea')
    expect(revisionNotes?.type === 'textarea' ? revisionNotes.admin?.description : undefined).toBe(
      'Reasons from the last information-gain run or reviewer; injected into the next generate prompt.',
    )

    const revisionCount = findField(Articles.fields, 'revisionCount')
    expect(revisionCount?.type).toBe('number')
    if (revisionCount?.type === 'number') {
      expect(revisionCount.defaultValue).toBe(0)
      expect(revisionCount.min).toBe(0)
      expect(revisionCount.admin?.description).toBe(
        'Times this article was sent back for regeneration. Informational.',
      )
    }
  })
})
