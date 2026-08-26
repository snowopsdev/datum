import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mockFixture } from '../src/fixtures'
import { createLlmClient } from '../src/llm'

describe('createLlmClient (mock mode)', () => {
  const client = createLlmClient('mock')

  // A dropped `fixtureKey` hands the research stage the whole
  // `{ page, facets }` object, which `parsePageClaims` rejects — so every mock
  // snapshot build fails at the first page.
  it('passes fixtureKey through to the fixture lookup', async () => {
    const page = await client.completeJSON(
      'claimExtraction',
      { system: 's', user: 'u', fixtureKey: 'page' },
      'claude-opus-5',
    )
    assert.deepEqual(page.json, mockFixture('claimExtraction', 'page'))
    assert.equal((page.json as { claims: unknown[] }).claims.length, 8)

    const facets = await client.completeJSON(
      'claimExtraction',
      { system: 's', user: 'u', fixtureKey: 'facets' },
      'claude-opus-5',
    )
    assert.deepEqual(facets.json, mockFixture('claimExtraction', 'facets'))
    assert.notDeepEqual(facets.json, page.json)
  })

  it('still returns the whole fixture when no fixtureKey is asked for', async () => {
    const result = await client.completeJSON('generate', { system: 's', user: 'u' }, 'claude-opus-5')
    assert.deepEqual(result.json, mockFixture('generate'))
    assert.equal(result.provider, 'mock')
  })
})

describe('mockFixture', () => {
  it('returns the claimExtraction sub-fixture for a given fixtureKey', () => {
    const page = mockFixture('claimExtraction', 'page') as { claims: unknown[] }
    assert.equal(page.claims.length, 8)

    const draft = mockFixture('claimExtraction', 'draft') as { claims: unknown[] }
    assert.equal(draft.claims.length, 13)
    assert.notDeepEqual(draft, page)
  })

  it('returns a fresh object each call', () => {
    const first = mockFixture('claimExtraction', 'draft') as { claims: unknown[] }
    const before = first.claims.length
    first.claims.push('mutated')
    const second = mockFixture('claimExtraction', 'draft') as { claims: unknown[] }
    assert.equal(second.claims.length, before)
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
