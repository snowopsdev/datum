import { describe, expect, it } from 'vitest'

import { CorpusSnapshots } from '@/collections/CorpusSnapshots'

import type { Field } from 'payload'

const findField = (fields: Field[], name: string): Field | undefined =>
  fields.find((f) => 'name' in f && f.name === name)

const topLevelFields: Array<{ name: string; type: string }> = [
  { name: 'keyword', type: 'text' },
  { name: 'keywordKey', type: 'text' },
  { name: 'country', type: 'text' },
  { name: 'capturedAt', type: 'date' },
  { name: 'status', type: 'select' },
  { name: 'pipelineRunId', type: 'text' },
  { name: 'snapshotHash', type: 'text' },
  { name: 'models', type: 'json' },
  { name: 'queryCluster', type: 'json' },
  { name: 'pages', type: 'array' },
  { name: 'internalCorpus', type: 'array' },
  { name: 'baselineClaims', type: 'json' },
  { name: 'facets', type: 'json' },
  { name: 'gaps', type: 'json' },
  { name: 'baselineDocCount', type: 'number' },
  { name: 'failedPageCount', type: 'number' },
]

const pagesSubfields: Array<{ name: string; type: string }> = [
  { name: 'position', type: 'number' },
  { name: 'url', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'domain', type: 'text' },
  { name: 'domainRating', type: 'number' },
  { name: 'fetchStatus', type: 'select' },
  { name: 'failureReason', type: 'text' },
  { name: 'chars', type: 'number' },
  { name: 'textHash', type: 'text' },
  { name: 'text', type: 'textarea' },
  { name: 'claimCount', type: 'number' },
  { name: 'unverifiedExcerptCount', type: 'number' },
]

const internalCorpusSubfields: Array<{ name: string; type: string }> = [
  { name: 'article', type: 'relationship' },
  { name: 'articleUpdatedAt', type: 'date' },
  { name: 'claimCount', type: 'number' },
]

describe('corpus-snapshots collection', () => {
  it('has slug corpus-snapshots and expected admin config', () => {
    expect(CorpusSnapshots.slug).toBe('corpus-snapshots')
    expect(CorpusSnapshots.admin?.useAsTitle).toBe('keyword')
    expect(CorpusSnapshots.admin?.defaultColumns).toEqual([
      'keyword',
      'country',
      'capturedAt',
      'status',
      'baselineDocCount',
    ])
    expect(CorpusSnapshots.timestamps).toBe(true)
  })

  it('has every top-level field with the right name and type, in order', () => {
    const names = CorpusSnapshots.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(topLevelFields.map((f) => f.name))

    for (const def of topLevelFields) {
      const field = findField(CorpusSnapshots.fields, def.name)
      expect(field?.type).toBe(def.type)
    }
  })

  it('marks keyword, keywordKey, country, capturedAt, status as required', () => {
    for (const name of ['keyword', 'keywordKey', 'country', 'capturedAt', 'status']) {
      const field = findField(CorpusSnapshots.fields, name)
      expect(field && 'required' in field ? field.required : undefined).toBe(true)
    }
  })

  it('indexes keyword, keywordKey, and pipelineRunId', () => {
    for (const name of ['keyword', 'keywordKey', 'pipelineRunId']) {
      const field = findField(CorpusSnapshots.fields, name)
      expect(field && 'index' in field ? field.index : undefined).toBe(true)
    }
  })

  it('describes keywordKey as the lower-cased reuse-lookup key', () => {
    const field = findField(CorpusSnapshots.fields, 'keywordKey')
    expect(field?.type === 'text' ? field.admin?.description : undefined).toBe(
      'Lower-cased, trimmed keyword used for reuse lookups.',
    )
  })

  it('offers the expected status options', () => {
    const field = findField(CorpusSnapshots.fields, 'status')
    expect(field?.type).toBe('select')
    if (field?.type === 'select') {
      expect(field.options).toEqual(['complete', 'partial', 'empty'])
    }
  })

  // Two different failures both store as `empty`; the description is where a
  // reader of a row learns how to tell them apart.
  it('says on status that empty covers a claimless build as well as a failed crawl', () => {
    const field = findField(CorpusSnapshots.fields, 'status')
    const description = field?.type === 'select' ? field.admin?.description : undefined
    expect(description).toContain('never reused')
    expect(description).toContain('no page yielded text (baselineDocCount 0)')
    expect(description).toContain('extraction produced no claims (baselineDocCount > 0)')
  })

  it('says on failedPageCount that skipped pages count too', () => {
    const field = findField(CorpusSnapshots.fields, 'failedPageCount')
    const description = field?.type === 'number' ? field.admin?.description : undefined
    expect(description).toContain('failed fetches and skipped ones')
    expect(description).toContain('a refused private address')
    expect(description).toContain('claim extraction came back empty')
  })

  it('has a pages array with the expected subfields', () => {
    const field = findField(CorpusSnapshots.fields, 'pages')
    expect(field?.type).toBe('array')
    if (field?.type !== 'array') return

    const names = field.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(pagesSubfields.map((f) => f.name))

    for (const def of pagesSubfields) {
      const subfield = findField(field.fields, def.name)
      expect(subfield?.type).toBe(def.type)
    }

    const url = findField(field.fields, 'url')
    expect(url && 'required' in url ? url.required : undefined).toBe(true)

    const fetchStatus = findField(field.fields, 'fetchStatus')
    expect(fetchStatus?.type).toBe('select')
    if (fetchStatus?.type === 'select') {
      expect(fetchStatus.options).toEqual(['ok', 'failed', 'skipped'])
      expect(fetchStatus.required).toBe(true)
    }

    const text = findField(field.fields, 'text')
    expect(text?.type === 'textarea' ? text.admin?.description : undefined).toBe(
      'Readable page text, capped at 24k chars (decision: stored for auditability).',
    )

    // Excerpts are counted, never dropped: a smaller baseline inflates novelty.
    const unverified = findField(field.fields, 'unverifiedExcerptCount')
    expect(unverified?.type === 'number' ? unverified.admin?.description : undefined).toBe(
      'Claims whose excerpt was not found in this page text; counted, not dropped.',
    )
  })

  it('has an internalCorpus array with the expected subfields', () => {
    const field = findField(CorpusSnapshots.fields, 'internalCorpus')
    expect(field?.type).toBe('array')
    if (field?.type !== 'array') return

    const names = field.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual(internalCorpusSubfields.map((f) => f.name))

    for (const def of internalCorpusSubfields) {
      const subfield = findField(field.fields, def.name)
      expect(subfield?.type).toBe(def.type)
    }

    const article = findField(field.fields, 'article')
    expect(article?.type).toBe('relationship')
    if (article?.type === 'relationship') {
      expect(article.relationTo).toBe('articles')
      expect(article.required).toBe(true)
    }

    const articleUpdatedAt = findField(field.fields, 'articleUpdatedAt')
    expect(
      articleUpdatedAt && 'required' in articleUpdatedAt ? articleUpdatedAt.required : undefined,
    ).toBe(true)
  })

  it('is readable only when authenticated, and never writable through the admin API', async () => {
    expect(await CorpusSnapshots.access?.read?.({ req: { user: null } } as never)).toBe(false)
    expect(await CorpusSnapshots.access?.read?.({ req: { user: { id: 1 } } } as never)).toBe(true)

    expect(await CorpusSnapshots.access?.create?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
    expect(await CorpusSnapshots.access?.update?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
    expect(await CorpusSnapshots.access?.delete?.({ req: { user: { id: 1 } } } as never)).toBe(
      false,
    )
  })
})
