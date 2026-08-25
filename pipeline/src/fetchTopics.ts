import type { GapKeyword } from './ahrefs'
import type { StageContext } from './stages'

/** fetch is Ahrefs-only — no LLM call — so it needs none of StageContext's model/voice/style-guide fields. */
export type FetchContext = Pick<StageContext, 'ahrefs' | 'payload' | 'runId' | 'mode'>

// Volume per point of difficulty; higher = better opportunity.
const score = (gap: GapKeyword): number => gap.volume / Math.max(gap.difficulty, 1)

const sentenceCase = (keyword: string): string =>
  keyword.charAt(0).toUpperCase() + keyword.slice(1)

export async function fetchTopics(ctx: FetchContext, count: number): Promise<void> {
  const gaps = await ctx.ahrefs.contentGapKeywords()
  // Only the top N ranked keywords are considered, so a rerun skips the same
  // ones instead of walking further down the list (idempotent).
  const ranked = [...gaps].sort((a, b) => score(b) - score(a)).slice(0, count)
  console.log(`[fetch] ${gaps.length} gap keyword(s) from Ahrefs, considering top ${ranked.length}`)
  let created = 0
  for (const gap of ranked) {
    const existing = await ctx.payload.find({
      collection: 'articles',
      where: { keyword: { equals: gap.keyword } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      console.log(`[fetch] skip "${gap.keyword}" — article ${existing.docs[0].id} already exists`)
      continue
    }
    const article = await ctx.payload.create({
      collection: 'articles',
      data: {
        keyword: gap.keyword,
        title: sentenceCase(gap.keyword),
        status: 'topic_selected',
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
    created += 1
    console.log(
      `[fetch] created article ${article.id} "${gap.keyword}" (volume ${gap.volume}, difficulty ${gap.difficulty}, best competitor position ${gap.bestCompetitorPosition})`,
    )
  }
  console.log(`[fetch] created ${created} article(s) at status topic_selected`)
}
