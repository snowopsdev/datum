import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAhrefsClient } from '../src/ahrefs'
import { fetchPage } from '../src/corpus/fetchPage'

const client = createAhrefsClient('mock')

describe('mock serpResearch pages', () => {
  it('renders the same three results as data and as summary text', async () => {
    const research = await client.serpResearch('home espresso station')
    assert.equal(research.pages.length, 3)
    assert.deepEqual(
      research.pages.map((p) => p.position),
      [1, 2, 3],
    )
    assert.deepEqual(
      research.pages.map((p) => p.domainRating),
      [78, 71, 66],
    )
    const summaryLines = research.rankingPagesSummary.split('\n')
    assert.equal(summaryLines.length, research.pages.length)
    for (const [index, page] of research.pages.entries()) {
      assert.ok(
        summaryLines[index]?.includes(page.url),
        `summary line ${index} should cite its url`,
      )
      assert.ok(summaryLines[index]?.includes(page.title ?? ''), `summary line ${index} title`)
    }
  })

  it('points at hosts that have canned page text in mock mode', async () => {
    const research = await client.serpResearch('home espresso station')
    const pages = await Promise.all(research.pages.map((p) => fetchPage(p.url, { mock: true })))
    assert.deepEqual(
      pages.map((p) => p.status),
      ['ok', 'ok', 'ok'],
    )
    // A host with no canned text falls back to the generic page, so three
    // distinct texts is the proof that each SERP host is actually covered.
    assert.equal(new Set(pages.map((p) => p.text)).size, 3)
  })
})
