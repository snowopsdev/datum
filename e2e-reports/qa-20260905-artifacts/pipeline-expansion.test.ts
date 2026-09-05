import assert from 'node:assert/strict'
import { it } from 'node:test'
import type { Article } from '../../cms/src/payload-types'
import { runPipeline, type Stage, type StageContext } from '../src/stages'

function fixture(count = 1) {
  const articles = Array.from({ length: count }, (_, index) => ({
    id: index + 1, status: 'topic_selected', keyword: `QA ${index}`,
  })) as Article[]
  let failures = 1
  let writes = 0
  const ctx = { payload: {
    find: async () => ({ docs: articles.filter((article) => article.status === 'topic_selected') }),
    update: async ({ id, data }: { id: number; data: Partial<Article> }) => {
      if (failures-- > 0) throw new Error('simulated write failure')
      writes += 1
      Object.assign(articles.find((article) => article.id === id)!, data)
    },
  }, runId: 'qa-expansion', mode: 'mock' } as unknown as StageContext
  const stage: Stage = { name: 'research', entryStatus: 'topic_selected', exitStatus: 'brief_review',
    run: async () => ({ status: 'brief_review', data: {}, warnings: ['bookkeeping warning'] }) }
  return { ctx, stage, writes: () => writes }
}

it('expansion1 pairwise: warnings do not count as saved progress after a rejected write', async () => {
  const { ctx, stage } = fixture()
  const result = await runPipeline(ctx, { stages: [stage] })
  assert.equal(result.stages[0].warned, 0)
  assert.equal(result.failed, 1)
})

it('expansion1 boundary: mixed batches report only the article that saved', async () => {
  const { ctx, stage } = fixture(2)
  const result = await runPipeline(ctx, { stages: [stage] })
  assert.deepEqual(result.articleIds, [2])
  assert.deepEqual(result.finalStatuses, { brief_review: 1 })
  assert.equal(result.stages[0].warned, 1)
})

it('expansion1 history: a failed save retries once and later runs leave the brief alone', async () => {
  const { ctx, stage, writes } = fixture()
  assert.equal((await runPipeline(ctx, { stages: [stage] })).failed, 1)
  assert.deepEqual((await runPipeline(ctx, { stages: [stage] })).finalStatuses, { brief_review: 1 })
  assert.deepEqual((await runPipeline(ctx, { stages: [stage] })).finalStatuses, {})
  assert.equal(writes(), 1)
})
