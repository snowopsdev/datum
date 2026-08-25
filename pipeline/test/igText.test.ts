import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  excerptFoundIn,
  keywordTokens,
  nearDuplicateJaccard,
  normaliseWhitespace,
  selectInternalCorpus,
  STOPWORDS,
  tokenOverlap,
} from '../src/informationGain/lib'

const close = (actual: number, expected: number, tolerance = 1e-9): void => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  )
}

const article = (id: number, keyword: string, updatedAt: string) => ({ id, keyword, updatedAt })

describe('keywordTokens', () => {
  it('lower-cases, splits on non-alphanumerics, and dedupes', () => {
    assert.deepEqual(keywordTokens('CRM software, CRM Software!'), ['crm', 'software'])
    assert.deepEqual(keywordTokens('email-marketing/automation'), [
      'email',
      'marketing',
      'automation',
    ])
  })

  it('drops stopwords and tokens shorter than three characters', () => {
    assert.ok(STOPWORDS.has('the'))
    assert.ok(STOPWORDS.has('2026'))
    assert.deepEqual(keywordTokens('the best guide to CRM in 2026'), ['crm'])
  })

  it('returns nothing for text made entirely of stopwords', () => {
    assert.deepEqual(keywordTokens('what is the best guide'), [])
    assert.deepEqual(keywordTokens('   '), [])
  })
})

describe('tokenOverlap', () => {
  it('counts the tokens two strings share', () => {
    assert.equal(tokenOverlap('best crm software', 'crm software pricing'), 2)
  })

  it('is 0 when nothing meaningful is shared', () => {
    assert.equal(tokenOverlap('best crm software', 'how to bake bread'), 0)
    // Shared stopwords do not count as overlap.
    assert.equal(tokenOverlap('the best of', 'the best guide'), 0)
  })
})

describe('selectInternalCorpus', () => {
  it('keeps only candidates that share at least one token', () => {
    const picked = selectInternalCorpus('crm software', [
      article(1, 'crm pricing', '2026-01-01T00:00:00.000Z'),
      article(2, 'bread recipes', '2026-06-01T00:00:00.000Z'),
    ])
    assert.deepEqual(
      picked.map((a) => a.id),
      [1],
    )
  })

  it('sorts by overlap first, then by recency', () => {
    const picked = selectInternalCorpus('best crm software pricing', [
      article(1, 'crm pricing', '2026-01-01T00:00:00.000Z'),
      article(2, 'crm', '2026-08-01T00:00:00.000Z'),
      article(3, 'crm software pricing', '2025-01-01T00:00:00.000Z'),
      article(4, 'crm pricing', '2026-05-01T00:00:00.000Z'),
    ])
    assert.deepEqual(
      picked.map((a) => a.id),
      [3, 4, 1, 2],
    )
  })

  it('caps the corpus at five candidates by default and honours an explicit cap', () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      article(i + 1, 'crm software', `2026-01-0${i + 1}T00:00:00.000Z`),
    )
    assert.equal(selectInternalCorpus('crm software', candidates).length, 5)
    assert.equal(selectInternalCorpus('crm software', candidates, 2).length, 2)
  })

  it('returns nothing when the keyword has no usable tokens', () => {
    assert.deepEqual(
      selectInternalCorpus('the best guide', [article(1, 'crm', '2026-01-01T00:00:00.000Z')]),
      [],
    )
  })
})

describe('normaliseWhitespace', () => {
  it('collapses runs of whitespace and trims', () => {
    assert.equal(normaliseWhitespace('  a \n\t b   c  '), 'a b c')
  })

  it('leaves already-normal text alone', () => {
    assert.equal(normaliseWhitespace('a b c'), 'a b c')
  })
})

describe('excerptFoundIn', () => {
  it('matches across line breaks and casing', () => {
    assert.equal(excerptFoundIn('The CRM  costs', 'a crm\ncosts $30 per seat'), false)
    assert.equal(excerptFoundIn('CRM  costs', 'a crm\ncosts $30 per seat'), true)
    assert.equal(excerptFoundIn('crm costs', 'A CRM COSTS $30'), true)
  })

  it('is false for an excerpt that is not there, and for an empty excerpt', () => {
    assert.equal(excerptFoundIn('missing text', 'a crm costs $30'), false)
    assert.equal(excerptFoundIn('', 'a crm costs $30'), false)
    assert.equal(excerptFoundIn('   ', 'a crm costs $30'), false)
  })
})

describe('nearDuplicateJaccard', () => {
  it('is the Jaccard index over keyword tokens', () => {
    // {crm, software} vs {crm, pricing} → 1 shared, 3 distinct.
    close(nearDuplicateJaccard('crm software', 'crm pricing'), 1 / 3)
    assert.equal(nearDuplicateJaccard('crm software', 'software crm'), 1)
  })

  it('is 0 when either side has no tokens or nothing is shared', () => {
    assert.equal(nearDuplicateJaccard('crm software', 'bread recipes'), 0)
    assert.equal(nearDuplicateJaccard('', 'crm software'), 0)
    assert.equal(nearDuplicateJaccard('the best of', 'crm software'), 0)
  })
})
