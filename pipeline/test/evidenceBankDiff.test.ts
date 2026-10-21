import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  evidenceBankChanges,
  isClaimDirty,
  normaliseClaimKey,
  spliceVisible,
  visibleClaimIndexes,
} from '../../cms/src/lib/tenant/evidenceBankDiff'

const claim = (over: Record<string, unknown> = {}) => ({
  ref: 'E1',
  claim: 'Six grinders tested',
  primarySource: 'Test log',
  sourceUrl: '',
  sourceDate: '2026-08-01T00:00:00.000Z',
  sampleOrMethod: '',
  verificationDepth: 'primary_document' as const,
  limits: '',
  clearedSurfaces: ['web', 'blog'] as ('web' | 'blog')[],
  recheckAt: '2027-06-30',
  ...over,
})

const bank = (verifiedClaims: ReturnType<typeof claim>[] = [claim()]) => ({
  verifiedClaims,
  facts: [{ ref: 'F1', fact: 'Founded 2019', source: '', owner: '', lastConfirmedAt: '' }],
  rejectedClaims: [],
})

describe('evidenceBankChanges', () => {
  it('is zero for an untouched bank, whatever the date format or key order', () => {
    const saved = bank()
    const current = bank([
      claim({ sourceDate: '2026-08-01', clearedSurfaces: ['blog', 'web'], extra: 'client-only' }),
    ])
    assert.equal(evidenceBankChanges(saved, current).total, 0)
  })

  it('counts an edit to a saved row, an added row, and a removed row', () => {
    const saved = bank([claim(), claim({ ref: 'E2', claim: 'Second claim' })])
    assert.deepEqual(
      evidenceBankChanges(saved, {
        ...saved,
        verifiedClaims: [claim({ limits: 'New limit' }), claim({ ref: 'E2', claim: 'Second claim' })],
      }),
      { added: 0, changed: 1, removed: 0, total: 1 },
    )
    assert.deepEqual(
      evidenceBankChanges(saved, {
        ...saved,
        verifiedClaims: [claim(), { ...claim({ claim: 'Brand new' }), ref: undefined }],
      }),
      { added: 1, changed: 0, removed: 1, total: 2 },
    )
  })

  it('does not count a blank new row, which the save drops', () => {
    const saved = bank()
    const current = {
      ...saved,
      verifiedClaims: [...saved.verifiedClaims, { ...claim({ claim: '   ' }), ref: undefined }],
    }
    assert.equal(evidenceBankChanges(saved, current).total, 0)
  })

  it('counts a saved row whose text was cleared as removed, since the save drops it', () => {
    const saved = bank()
    const current = { ...saved, verifiedClaims: [claim({ claim: '' })] }
    assert.deepEqual(evidenceBankChanges(saved, current), {
      added: 0,
      changed: 0,
      removed: 1,
      total: 1,
    })
  })

  it('compares facts and rejected claims too', () => {
    const saved = bank()
    const current = {
      ...saved,
      facts: [{ ...saved.facts[0]!, owner: 'Sam' }],
      rejectedClaims: [
        { claim: 'Fastest grinder', status: 'rejected' as const, reason: '', replacement: '' },
      ],
    }
    assert.equal(evidenceBankChanges(saved, current).total, 2)
  })
})

describe('the needs-re-check filter', () => {
  const expired = (row: { recheckAt?: string }) => Boolean(row.recheckAt && row.recheckAt < '2027-01-01')
  const saved = [
    claim({ ref: 'E1', recheckAt: '2026-01-01' }),
    claim({ ref: 'E2', recheckAt: '2027-06-30' }),
  ]

  it('shows expired rows, new rows, and rows with unsaved edits', () => {
    assert.deepEqual(visibleClaimIndexes(saved, saved, expired), [0])

    const edited = [
      // Fixing the date on an expired row must not make it vanish mid-edit.
      claim({ ref: 'E1', recheckAt: '2028-01-01' }),
      saved[1]!,
      { ...claim({ claim: 'typing…' }), ref: undefined },
    ]
    assert.deepEqual(visibleClaimIndexes(edited, saved, expired), [0, 2])
    assert.equal(isClaimDirty(edited[1]!, saved), false)
  })

  it('splices edits back without duplicating rows', () => {
    const full = ['a', 'b', 'c', 'd']
    const visible = [1, 3]
    assert.deepEqual(spliceVisible(full, visible, ['B', 'd']), ['a', 'B', 'c', 'd'])
    assert.deepEqual(spliceVisible(full, visible, ['b']), ['a', 'b', 'c'])
    assert.deepEqual(spliceVisible(full, visible, ['d']), ['a', 'c', 'd'])
    assert.deepEqual(spliceVisible(full, visible, ['b', 'd', 'new']), ['a', 'b', 'c', 'd', 'new'])
  })
})

describe('normaliseClaimKey', () => {
  it('ignores case, spacing and punctuation', () => {
    const key = normaliseClaimKey('Kettle & Burr tested six budget espresso grinders for a month')
    assert.equal(
      normaliseClaimKey('  kettle  &  burr TESTED six budget espresso grinders, for a month.  '),
      key,
    )
    assert.notEqual(normaliseClaimKey('Kettle & Burr tested seven grinders'), key)
    assert.equal(normaliseClaimKey(undefined), '')
  })
})
