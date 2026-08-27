import assert from 'node:assert/strict'
import { it } from 'node:test'

import type { Payload } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'
import type { AhrefsClient } from '../src/ahrefs'
import { loadStyleGuide } from '../src/styleGuide'
import { resolvePolicy } from '../src/informationGain/lib'
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
  const snapshotRows: Array<Record<string, unknown>> = []
  const igRunRows: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({
      collection,
      where,
    }: {
      collection: string
      where?: Record<string, unknown>
    }) => {
      if (collection === 'cost-log') {
        // Two shapes reach this collection: qa's `{ article: { equals } }` and
        // the informationGain stage's `{ and: [...] }`, which additionally
        // scopes by run id and stage.
        const and =
          (where?.and as Array<Record<string, { equals?: unknown; in?: unknown[] }>>) ?? []
        const articleId =
          (where?.article as { equals?: number } | undefined)?.equals ??
          (and.find((clause) => clause.article)?.article.equals as number | undefined)
        const stages = and.find((clause) => clause.stage)?.stage.in as string[] | undefined
        return {
          docs: costRows.filter(
            (row) => row.article === articleId && (!stages || stages.includes(row.stage as string)),
          ),
        }
      }
      // The research stage looks for a reusable corpus snapshot and for its own
      // published articles; this scoped run has neither, so both come back empty
      // and the stage builds a fresh snapshot from the mock pages.
      if (collection === 'corpus-snapshots') return { docs: snapshotRows }
      if (collection === 'articles' && !where?.and) return { docs: [] }
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
      if (collection === 'corpus-snapshots') {
        snapshotRows.push({ id: snapshotRows.length + 1, ...data })
        return snapshotRows[snapshotRows.length - 1]
      }
      if (collection === 'information-gain-runs') {
        igRunRows.push({ id: igRunRows.length + 1, ...data })
        return igRunRows[igRunRows.length - 1]
      }
      assert.equal(collection, 'cost-log')
      costRows.push(data)
      return { id: costRows.length, ...data }
    },
  } as unknown as Payload
  // The hosts must be ones `corpus/mockPages.ts` has text for, exactly as
  // `MockAhrefsClient` does: a SERP with no crawlable pages builds an empty
  // corpus snapshot, which the research stage now refuses rather than passing
  // an ungoverned article on to generation.
  const ahrefs: AhrefsClient = {
    contentGapKeywords: async () => [],
    discoverKeywords: async () => [],
    serpResearch: async (keyword) => ({
      rankingPagesSummary: 'Research summary',
      commonSubtopics: ['Equipment'],
      relatedQuestions: ['What does it cost?'],
      pages: [
        {
          position: 1,
          title: `The complete guide to ${keyword}`,
          url: 'https://competitor-one.com/blog/guide',
          domainRating: 78,
        },
        {
          position: 2,
          title: `${keyword}: what actually works`,
          url: 'https://competitor-two.com/guide',
          domainRating: 71,
        },
        {
          position: 3,
          title: `10 lessons from doing ${keyword} the hard way`,
          url: 'https://industry-mag.example.com/lessons',
          domainRating: 66,
        },
      ],
    }),
  }
  const ctx: StageContext = {
    payload,
    ahrefs,
    runId: 'scope-1',
    mode: 'mock',
    // This test is about *which* articles a scoped run touches, not the brief
    // checkpoint, so the stop after research is switched off to let the run
    // walk all four stages in one pass.
    pauseForBrief: false,
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
    // The mock verifier fixture cites these three domains; without the rules
    // their evidence is capped below the numeric integrity floor and the draft
    // is blocked rather than verified (see `cms/src/seed.ts`).
    evidenceSources: [
      { domain: 'sca.coffee', qualityClass: 'primary', active: true },
      { domain: 'baristahustle.com', qualityClass: 'primary', active: true },
      { domain: 'homegrounds.co', qualityClass: 'primary', active: true },
    ],
    policy: { ...resolvePolicy(null, {}), version: 'ig-test' },
  }

  const result = await runPipeline(ctx, { articleIds: [1] })

  assert.equal(result.failed, 0, 'the scoped run should not have failed any article')
  assert.equal(snapshotRows.length, 1, 'the scoped run should have built one corpus snapshot')
  assert.notEqual(snapshotRows[0]?.status, 'empty')
  assert.equal(articles.get(1)?.status, 'verified')
  assert.equal(igRunRows.length, 1, 'the scoped run should have written one information-gain run')
  assert.equal(igRunRows[0]?.decision, 'PASS')
  assert.equal(articles.get(2)?.status, 'topic_selected')
  assert.deepEqual(result.articleIds, [1])
  assert.deepEqual(result.finalStatuses, { verified: 1 })
})
