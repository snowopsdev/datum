import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mockFixture } from '../src/fixtures'

describe('mockFixture', () => {
  it('returns the claimExtraction sub-fixture for a given fixtureKey', () => {
    assert.deepEqual(mockFixture('claimExtraction', 'page'), { claims: [] })
  })

  it('returns a fresh object each call', () => {
    const first = mockFixture('claimExtraction', 'page') as { claims: unknown[] }
    first.claims.push('mutated')
    const second = mockFixture('claimExtraction', 'page') as { claims: unknown[] }
    assert.deepEqual(second, { claims: [] })
  })

  it('throws for an unknown fixtureKey', () => {
    assert.throws(
      () => mockFixture('claimExtraction', 'nonexistent'),
      /no mock fixture for claimExtraction\/nonexistent/,
    )
  })

  it('leaves the whole-stage generate fixture unchanged', () => {
    const fixture = mockFixture('generate') as { title: string; slug: string }
    assert.equal(fixture.title, 'How to set up a home espresso station')
    assert.equal(fixture.slug, 'home-espresso-station-setup')
  })
})
