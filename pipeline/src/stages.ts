import type { Payload, Where } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'

import type { AhrefsClient } from './ahrefs'
import type { BrandVoiceContent } from './brandVoice'
import { generateStage } from './generate'
import { qaStage } from './qa/index'
import { researchStage } from './research'
import type { StageModels } from './models'
import type { StyleGuide } from './styleGuide'
import type { LlmClient } from './llm'

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
  /** Run-scoped provider adapter. Optional for backwards-compatible test contexts. */
  llm?: LlmClient
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

export interface RunPipelineOptions {
  articleIds?: number[]
}

export interface RunPipelineResult {
  articleIds: number[]
  finalStatuses: Record<string, number>
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

export async function runPipeline(
  ctx: StageContext,
  options: RunPipelineOptions = {},
): Promise<RunPipelineResult> {
  const processed = new Set<number>()
  const finalStatusByArticle = new Map<number, ArticleStatus>()
  for (const stage of stages) {
    const and: Where[] = [{ status: { equals: stage.entryStatus } }, { template: { exists: true } }]
    if (options.articleIds?.length) and.push({ id: { in: options.articleIds } })
    const { docs } = await ctx.payload.find({
      collection: 'articles',
      where: { and },
      pagination: false,
      depth: 1,
      sort: 'createdAt',
    })
    console.log(`[${stage.name}] ${docs.length} article(s) at status "${stage.entryStatus}"`)
    for (const article of docs) {
      const outcome = await stage.run(article, ctx)
      processed.add(article.id)
      finalStatusByArticle.set(article.id, outcome.status)
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
      console.log(`[${stage.name}] article ${article.id} "${article.keyword}" -> ${outcome.status}`)
    }
  }
  const finalStatuses: Record<string, number> = {}
  for (const status of finalStatusByArticle.values()) {
    finalStatuses[status] = (finalStatuses[status] ?? 0) + 1
  }
  return { articleIds: [...processed], finalStatuses }
}
