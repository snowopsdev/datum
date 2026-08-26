import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mockPageText } from '../src/corpus/mockPages'
import {
  FACET_CLAIM_CAP,
  INTERNAL_CORPUS_CAP,
  isSnapshotReusable,
  keywordKey,
  SERP_PAGE_CAP,
  SNAPSHOT_REUSE_DAYS,
  snapshotAgeDays,
  snapshotHash,
  snapshotStatus,
  textHash,
} from '../src/corpus/snapshot'
import { mockFixture } from '../src/fixtures'
import {
  excerptFoundIn,
  parseFacetClustering,
  parsePageClaims,
  type BaselineClaim,
} from '../src/informationGain/lib'

const NOW = new Date('2026-08-25T12:00:00.000Z')

const daysAgo = (days: number): string =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe('keywordKey', () => {
  it('trims, lower-cases, and collapses whitespace', () => {
    assert.equal(keywordKey('  Home   Espresso\tSetup  '), 'home espresso setup')
  })

  it('maps casing and spacing variants of one keyword to the same key', () => {
    assert.equal(keywordKey('Home Espresso Setup'), keywordKey('home  espresso setup'))
  })

  it('handles an empty keyword', () => {
    assert.equal(keywordKey('   '), '')
  })
})

describe('snapshot caps', () => {
  it('holds the agreed corpus limits', () => {
    assert.equal(SNAPSHOT_REUSE_DAYS, 14)
    assert.equal(SERP_PAGE_CAP, 10)
    assert.equal(INTERNAL_CORPUS_CAP, 5)
    assert.equal(FACET_CLAIM_CAP, 400)
  })
})

describe('snapshotAgeDays', () => {
  it('measures age in fractional days', () => {
    assert.equal(snapshotAgeDays(daysAgo(2), NOW), 2)
    assert.equal(snapshotAgeDays(daysAgo(0.5), NOW), 0.5)
  })

  it('is null for a timestamp it cannot read', () => {
    assert.equal(snapshotAgeDays('not a date', NOW), null)
  })
})

describe('isSnapshotReusable', () => {
  it('reuses a snapshot inside the reuse window', () => {
    assert.equal(isSnapshotReusable({ capturedAt: daysAgo(13), status: 'complete' }, NOW), true)
  })

  it('reuses a partial snapshot inside the window', () => {
    assert.equal(isSnapshotReusable({ capturedAt: daysAgo(1), status: 'partial' }, NOW), true)
  })

  it('rejects a snapshot older than the reuse window', () => {
    assert.equal(isSnapshotReusable({ capturedAt: daysAgo(15), status: 'complete' }, NOW), false)
  })

  it('never reuses an empty snapshot, however fresh', () => {
    assert.equal(isSnapshotReusable({ capturedAt: daysAgo(0), status: 'empty' }, NOW), false)
  })

  it('rejects an unparseable capturedAt', () => {
    assert.equal(isSnapshotReusable({ capturedAt: 'not a date', status: 'complete' }, NOW), false)
  })
})

describe('snapshotStatus', () => {
  it('is complete when every page fetched', () => {
    assert.equal(snapshotStatus(3, 0), 'complete')
  })

  it('is partial when some pages failed', () => {
    assert.equal(snapshotStatus(2, 1), 'partial')
  })

  it('is empty when every page failed', () => {
    assert.equal(snapshotStatus(0, 3), 'empty')
  })

  it('is empty when there were no pages at all', () => {
    assert.equal(snapshotStatus(0, 0), 'empty')
  })
})

describe('snapshotHash', () => {
  const pages = [
    { url: 'https://a.example.com/one', textHash: 'aaa' },
    { url: 'https://b.example.com/two', textHash: 'bbb' },
    { url: 'https://c.example.com/three', textHash: 'ccc' },
  ]

  it('is stable under page order', () => {
    assert.equal(snapshotHash(pages), snapshotHash([...pages].reverse()))
  })

  it('changes when a page body changes', () => {
    const changed = [{ ...pages[0], textHash: 'zzz' }, pages[1], pages[2]]
    assert.notEqual(snapshotHash(pages), snapshotHash(changed))
  })

  it('changes when a page is dropped', () => {
    assert.notEqual(snapshotHash(pages), snapshotHash(pages.slice(0, 2)))
  })

  it('returns a hex sha256', () => {
    assert.match(snapshotHash(pages), /^[0-9a-f]{64}$/)
  })
})

describe('textHash', () => {
  it('is deterministic', () => {
    assert.equal(textHash('one two three'), textHash('one two three'))
  })

  it('distinguishes different text', () => {
    assert.notEqual(textHash('one two three'), textHash('one two four'))
  })

  it('returns a hex sha256', () => {
    assert.match(textHash(''), /^[0-9a-f]{64}$/)
  })
})

describe('claimExtraction mock fixtures', () => {
  const pageClaims = (prefix: string, position: number): BaselineClaim[] =>
    parsePageClaims(mockFixture('claimExtraction', 'page'), {
      docId: `serp:${position}`,
      sourceKind: 'serp',
      idPrefix: prefix,
      url: `https://competitor-${position}.example.com/guide`,
    })

  it('parses the page fixture into eight baseline claims', () => {
    const claims = pageClaims('b1', 1)
    assert.equal(claims.length, 8)
    assert.deepEqual(
      claims.map((claim) => claim.id),
      ['b1-1', 'b1-2', 'b1-3', 'b1-4', 'b1-5', 'b1-6', 'b1-7', 'b1-8'],
    )
    assert.ok(claims.every((claim) => claim.text.length > 0 && claim.excerpt.length > 0))
    assert.ok(claims.every((claim) => claim.facetId === null))
    assert.deepEqual(claims[0].values, ['$500', '$1,500'])
  })

  it('clusters three pages of fixture claims into five facets', () => {
    const claims = [...pageClaims('b1', 1), ...pageClaims('b2', 2), ...pageClaims('b3', 3)]
    assert.equal(claims.length, 24)

    const hints = ['What you need', 'Step-by-step instructions', 'Common mistakes', 'FAQ']
    const { facets, gaps, claimFacet } = parseFacetClustering(
      mockFixture('claimExtraction', 'facets'),
      claims,
      hints,
      3,
    )

    assert.equal(facets.length, 5)
    assert.deepEqual(
      facets.map((facet) => facet.id),
      ['f1', 'f2', 'f3', 'f4', 'f5'],
    )
    assert.deepEqual(
      facets.filter((facet) => facet.mustHave).map((facet) => facet.label),
      ['What you need', 'Step-by-step instructions', 'Common mistakes'],
    )
    // Every fixture claim appears in exactly one facet, so each facet sees all
    // three baseline documents.
    assert.equal(claimFacet.size, claims.length)
    assert.ok(claims.every((claim) => claimFacet.has(claim.id)))
    assert.ok(facets.every((facet) => facet.docCount === 3))
    assert.equal(
      facets.reduce((sum, facet) => sum + facet.claimIds.length, 0),
      claims.length,
    )
    assert.equal(gaps.length, 2)
    assert.equal(gaps[0].facetId, 'f1')
    assert.equal(gaps[1].facetId, null)
  })

  it('quotes every excerpt verbatim from every mock page host', () => {
    const claims = pageClaims('b1', 1)
    const hosts = [
      'https://competitor-one.com/blog/guide',
      'https://competitor-two.com/guide',
      'https://industry-mag.example.com/lessons',
      // Any other host falls back to the generic mock page.
      'https://unknown-host.example.org/guide',
    ]
    for (const host of hosts) {
      const { text } = mockPageText(host)
      for (const claim of claims) {
        assert.ok(
          excerptFoundIn(claim.excerpt, text),
          `${host} is missing excerpt "${claim.excerpt}"`,
        )
      }
    }
  })
})
