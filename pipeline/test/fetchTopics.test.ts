import assert from 'node:assert/strict'
import { it } from 'node:test'

import type { Payload } from 'payload'

import type { AhrefsClient } from '../src/ahrefs'
import { fetchTopics } from '../src/fetchTopics'

it('creates the requested number of unique topics with the selected template', async () => {
  const keywords = ['already exists', 'first new topic', 'second new topic']
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({ where }: { where: { keyword: { equals: string } } }) => ({
      docs: where.keyword.equals === 'already exists' ? [{ id: 9 }] : [],
    }),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length + 20, ...data }
    },
  } as unknown as Payload
  const ahrefs: AhrefsClient = {
    contentGapKeywords: async () =>
      keywords.map((keyword, index) => ({
        keyword,
        volume: 300 - index * 10,
        difficulty: 10,
        bestCompetitorPosition: index + 1,
      })),
    serpResearch: async () => ({
      rankingPagesSummary: '',
      commonSubtopics: [],
      relatedQuestions: [],
    }),
  }

  const result = await fetchTopics(
    { payload, ahrefs, mode: 'mock', runId: 'run-1' },
    { count: 2, templateId: 44 },
  )

  assert.deepEqual(result.createdIds, [21, 22])
  assert.deepEqual(result.skippedIds, [9])
  assert.deepEqual(
    created.map((data) => [data.keyword, data.template, data.status]),
    [
      ['first new topic', 44, 'topic_selected'],
      ['second new topic', 44, 'topic_selected'],
    ],
  )
})
