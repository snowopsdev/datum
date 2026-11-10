import type { PayloadRequest } from 'payload'

import { notOurUserMatch } from './tenant'
import { opportunityScore } from './ahrefs'
import type { RunPipelineOptions, StageContext } from './stages'

/** fetch is Ahrefs-only — no LLM call — so it needs none of StageContext's model/voice/style-guide fields. */
export type FetchContext = Pick<
  StageContext,
  'ahrefs' | 'payload' | 'runId' | 'mode' | 'tenant' | 'signal'
>

export interface FetchTopicsOptions {
  count: number
  templateId: number
  /**
   * The primary audience, so a discovered topic starts pointed at somebody.
   * The research stage backfills it when this is null, but setting it here
   * means the board shows the audience before research has run.
   */
  icpId?: number | null
  /**
   * Commits each topic only while the run still owns its row, as the stage
   * loop does for article writes (`RunPipelineOptions.commitArticle`).
   * Discovery stops once it refuses.
   */
  commitArticle?: RunPipelineOptions['commitArticle']
}

export interface FetchTopicsResult {
  createdIds: number[]
  skippedIds: number[]
}

const sentenceCase = (keyword: string): string => keyword.charAt(0).toUpperCase() + keyword.slice(1)

export async function fetchTopics(
  ctx: FetchContext,
  options: FetchTopicsOptions,
): Promise<FetchTopicsResult> {
  const count = Math.max(1, Math.min(5, Math.round(options.count)))
  ctx.signal?.throwIfAborted()
  const gaps = await ctx.ahrefs.contentGapKeywords()
  const ranked = [...gaps].sort(
    (a, b) => opportunityScore(b.volume, b.difficulty) - opportunityScore(a.volume, a.difficulty),
  )
  console.log(`[fetch] ${gaps.length} gap keyword(s) from Ahrefs, creating up to ${count}`)
  const { docs } =
    ranked.length > 0
      ? await ctx.payload.find({
          collection: 'articles',
          where: { keyword: { in: ranked.map((gap) => gap.keyword) } },
          select: { keyword: true },
          depth: 0,
          pagination: false,
        })
      : { docs: [] }
  const existingByKeyword = new Map(docs.map((doc) => [doc.keyword, doc.id]))
  const createdIds: number[] = []
  const skippedIds: number[] = []
  for (const gap of ranked) {
    if (createdIds.length >= count) break
    const exclusion = notOurUserMatch(gap.keyword, ctx.tenant.icps)
    if (exclusion) {
      console.log(`[fetch] skip "${gap.keyword}" — not our user: ${exclusion}`)
      continue
    }
    const existingId = existingByKeyword.get(gap.keyword)
    if (existingId != null) {
      console.log(`[fetch] skip "${gap.keyword}" — article ${existingId} already exists`)
      skippedIds.push(existingId)
      continue
    }
    // A run that lost its lease creates no further topics.
    ctx.signal?.throwIfAborted()
    const created: { id?: number } = {}
    const create = async (req?: PayloadRequest) => {
      const doc = await ctx.payload.create({
        collection: 'articles',
        ...(req ? { req } : {}),
        data: {
          keyword: gap.keyword,
          title: sentenceCase(gap.keyword),
          status: 'topic_selected',
          template: options.templateId,
          ...(options.icpId != null ? { icp: options.icpId } : {}),
        },
        context: {
          articleAudit: {
            actor: 'pipeline',
            actorType: 'pipeline',
            event: 'topic_created',
            pipelineRunId: ctx.runId,
            stage: 'fetch',
            summary: `Topic created from ${ctx.mode} content-gap research`,
            details: {
              mode: ctx.mode,
              keyword: gap.keyword,
              volume: gap.volume,
              difficulty: gap.difficulty,
              bestCompetitorPosition: gap.bestCompetitorPosition,
            },
          },
        },
      })
      created.id = doc.id
    }
    const owned = options.commitArticle
      ? await options.commitArticle(create)
      : (await create(), true)
    if (!owned || created.id === undefined) {
      throw ctx.signal?.reason ?? new Error(`Run ${ctx.runId} no longer owns its row.`)
    }
    existingByKeyword.set(gap.keyword, created.id)
    createdIds.push(created.id)
    console.log(
      `[fetch] created article ${created.id} "${gap.keyword}" (volume ${gap.volume}, difficulty ${gap.difficulty}, best competitor position ${gap.bestCompetitorPosition})`,
    )
  }
  console.log(`[fetch] created ${createdIds.length} article(s) at status topic_selected`)
  return { createdIds, skippedIds }
}
