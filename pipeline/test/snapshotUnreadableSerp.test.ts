import assert from 'node:assert/strict'
import test from 'node:test'
import type { Payload } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'
import type { SerpResearch } from '../src/ahrefs'
// Initialise the stage registry before its circular QA dependency.
import type { StageContext } from '../src/stages'
import { getOrBuildSnapshot } from '../src/corpus/snapshot'
import type { LlmClient } from '../src/llm'
import { loadStyleGuide } from '../src/styleGuide'
import { emptyTenantContext } from '../src/tenant'

const article = {
  id: 1,
  keyword: 'stream games',
  title: 'Stream games',
  status: 'topic_selected',
  template: { id: 1, name: 'How-To' } as Template,
} as Article

test('an unreadable SERP writes the empty row and throws before any extraction or clustering', async () => {
  const llmCalls: string[] = []
  const created: { collection: string; data: Record<string, unknown> }[] = []
  const finds: string[] = []
  const llm: LlmClient = {
    async completeJSON(stage) {
      llmCalls.push(stage)
      throw new Error('no model call expected')
    },
  }
  const publishedDocs = Array.from({ length: 5 }, (_, index) => ({
    id: index + 10,
    keyword: article.keyword,
    title: article.title,
    updatedAt: '2026-10-06T00:00:00.000Z',
  }))
  const payload = {
    async find({ collection }: { collection: string }) {
      finds.push(collection)
      // Published articles on the topic are available: before the fix they were
      // sent to paid claim extraction even though the SERP gave no baseline.
      return { docs: collection === 'articles' ? publishedDocs : [] }
    },
    async create(args: { collection: string; data: Record<string, unknown> }) {
      created.push(args)
      return { id: 77 }
    },
  } as unknown as Payload
  const ctx = {
    payload,
    llm,
    // Live, so pages are really "fetched" — loopback addresses are refused by
    // the address guard before any DNS lookup or request.
    mode: 'live',
    runId: 'unreadable-serp',
    tenant: emptyTenantContext(),
    styleGuide: loadStyleGuide(),
    brandVoice: null,
    models: { claimExtraction: 'claude-opus-5' },
    evidenceSources: [],
  } as unknown as StageContext
  const serp = {
    pages: [1, 2, 3].map((position) => ({
      position,
      url: `http://127.0.0.1/page-${position}`,
      title: 'Stream games',
    })),
  } as SerpResearch

  await assert.rejects(
    getOrBuildSnapshot(ctx, article, article.template as Template, serp, []),
    /corpus snapshot 77 for "stream games" is empty: no page could be read.*0\/3 ranking page\(s\) read/,
  )

  assert.deepEqual(llmCalls, [], 'no extraction or clustering call')
  assert.ok(!finds.includes('articles'), 'internal corpus was not even loaded')
  const snapshots = created.filter((entry) => entry.collection === 'corpus-snapshots')
  assert.equal(snapshots.length, 1)
  const row = snapshots[0].data
  assert.equal(row.status, 'empty')
  assert.equal(row.failedPageCount, 3)
  assert.deepEqual(row.baselineClaims, [])
  assert.deepEqual(row.internalCorpus, [])
  assert.equal((row.pages as unknown[]).length, 3)
  assert.equal(created.filter((entry) => entry.collection === 'cost-log').length, 0)
})
