import type { Payload } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'

import type { AhrefsClient } from './ahrefs'
import type { BrandVoiceContent } from './brandVoice'
import { generateStage } from './generate'
import { qaStage } from './qa/index'
import { researchStage } from './research'
import type { StageModels } from './models'
import type { StyleGuide } from './styleGuide'

export type ArticleStatus = Article['status']

export interface StageContext {
  payload: Payload
  runId: string
  mode: 'mock' | 'live'
  ahrefs: AhrefsClient
  styleGuide: StyleGuide
  /** Model per LLM stage for this run (admin Models global → env → default). */
  models: StageModels
  /** The tenant's active brand voice; null when none has been activated. */
  brandVoice: BrandVoiceContent | null
}

export interface StageOutcome {
  data: Partial<Article>
  status: ArticleStatus
}

export interface Stage {
  name: 'research' | 'generate' | 'qa'
  entryStatus: ArticleStatus
  exitStatus: ArticleStatus
  run(article: Article, ctx: StageContext): Promise<StageOutcome>
}

/**
 * The whole pipeline as a table. pipeline:run walks it in order; work is
 * selected purely by current status, so re-running converges instead of
 * duplicating work.
 */
export const stages: Stage[] = [researchStage, generateStage, qaStage]

export function resolveTemplate(article: Article): Template {
  if (article.template && typeof article.template === 'object') return article.template
  throw new Error(`article ${article.id} has no populated template`)
}

export async function runPipeline(ctx: StageContext): Promise<void> {
  for (const stage of stages) {
    const { docs } = await ctx.payload.find({
      collection: 'articles',
      where: {
        and: [{ status: { equals: stage.entryStatus } }, { template: { exists: true } }],
      },
      pagination: false,
      depth: 1,
      sort: 'createdAt',
    })
    console.log(`[${stage.name}] ${docs.length} article(s) at status "${stage.entryStatus}"`)
    let failed = 0
    for (const article of docs) {
      // One article's failure — a malformed LLM reply, a dead Payload write —
      // must not take the rest of the batch, or the stages behind it, down with
      // it. The article keeps its current status, so the next run retries it,
      // which is the same convergent-rerun property the whole loop relies on.
      try {
        const outcome = await stage.run(article, ctx)
        await ctx.payload.update({
          collection: 'articles',
          id: article.id,
          data: { ...outcome.data, status: outcome.status },
          context: {
            articleAudit: {
              actor: 'pipeline',
              actorType: 'pipeline',
              event: `${stage.name}_completed`,
              pipelineRunId: ctx.runId,
              stage: stage.name,
              summary: `${stage.name} completed in ${ctx.mode} mode`,
              details: {
                mode: ctx.mode,
                keyword: article.keyword,
                output: outcome.data,
              },
            },
          },
        })
        console.log(
          `[${stage.name}] article ${article.id} "${article.keyword}" -> ${outcome.status}`,
        )
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[${stage.name}] article ${article.id} failed: ${message}`, error)
      }
    }
    if (failed > 0) {
      console.log(
        `[${stage.name}] ${failed} of ${docs.length} article(s) failed and kept status ` +
          `"${stage.entryStatus}"; the next run retries them`,
      )
    }
  }
}
