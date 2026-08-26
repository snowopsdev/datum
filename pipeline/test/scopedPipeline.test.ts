import assert from 'node:assert/strict'
import { it } from 'node:test'

import type { Payload } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'
import type { AhrefsClient } from '../src/ahrefs'
import { loadStyleGuide } from '../src/styleGuide'
import { runPipeline, type StageContext } from '../src/stages'

const template: Template = {
  id: 11,
  name: 'How-To',
  requiredSections: [
    { heading: 'What you need' },
    { heading: 'Step-by-step instructions' },
    { heading: 'Common mistakes' },
    { heading: 'FAQ' },
  ],
  seoSpec: {
    titleTagMaxLength: 60,
    metaDescriptionMaxLength: 160,
    faqRequired: true,
    faqMinQuestions: 3,
    faqMaxQuestions: 6,
    ogTagsRequired: true,
  },
  updatedAt: '2026-08-25T00:00:00.000Z',
  createdAt: '2026-08-25T00:00:00.000Z',
}

function article(id: number): Article {
  return {
    id,
    keyword: `topic ${id}`,
    title: `Topic ${id}`,
    status: 'topic_selected',
    template,
    updatedAt: '2026-08-25T00:00:00.000Z',
    createdAt: '2026-08-25T00:00:00.000Z',
  }
}

it('advances only the article ids assigned to a scoped run', async () => {
  const articles = new Map<number, Article>([
    [1, article(1)],
    [2, article(2)],
  ])
  const costRows: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where?: Record<string, unknown>
    }) => {
      if (collection === 'cost-log') {
        const articleId = (where?.article as { equals?: number } | undefined)?.equals
        return { docs: costRows.filter((row) => row.article === articleId) }
      }
      const clauses =
        (where?.and as Array<Record<string, { equals?: unknown; exists?: boolean }>>) ?? []
      const status = clauses.find((clause) => clause.status)?.status.equals
      const ids = clauses.find((clause) => clause.id)?.id as { in?: number[] } | undefined
      return {
        docs: [...articles.values()].filter(
          (doc) => doc.status === status && (!ids?.in || ids.in.includes(doc.id as number)),
        ),
      }
    },
    update: async ({ id, data }: { id: number; data: Partial<Article> }) => {
      const current = articles.get(id)!
      const updated = { ...current, ...data } as Article
      articles.set(id, updated)
      return updated
    },
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      assert.equal(collection, 'cost-log')
      costRows.push(data)
      return { id: costRows.length, ...data }
    },
  } as unknown as Payload
  const ahrefs: AhrefsClient = {
    contentGapKeywords: async () => [],
    serpResearch: async () => ({
      rankingPagesSummary: 'Research summary',
      commonSubtopics: ['Equipment'],
      relatedQuestions: ['What does it cost?'],
    }),
  }
  const ctx: StageContext = {
    payload,
    ahrefs,
    runId: 'scope-1',
    mode: 'mock',
    styleGuide: loadStyleGuide(),
    models: {
      generate: 'claude-opus-5',
      factCheck: 'claude-opus-5',
      qualitativeReview: 'claude-opus-5',
      claimExtraction: 'claude-opus-5',
      informationGainJudge: 'claude-opus-5',
      evidenceVerification: 'claude-opus-5',
    },
    brandVoice: null,
  }

  const result = await runPipeline(ctx, { articleIds: [1] })

  assert.equal(articles.get(1)?.status, 'qa_passed')
  assert.equal(articles.get(2)?.status, 'topic_selected')
  assert.deepEqual(result.articleIds, [1])
  assert.deepEqual(result.finalStatuses, { qa_passed: 1 })
})
