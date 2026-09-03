import type { Payload, Where } from 'payload'

import type { Article, Template } from '../../cms/src/payload-types'

import type { AhrefsClient } from './ahrefs'
import type { PipelineStageName } from './articleStatusMeta'
import type { BrandVoiceContent } from './brandVoice'
import { generateStage } from './generate'
import { informationGainStage } from './informationGain/index'
import type { RunPolicy } from './informationGain/policy'
import { qaStage } from './qa/index'
import { researchStage } from './research'
import type { StageModels } from './models'
import type { StyleGuide } from './styleGuide'
import type { EvidenceSourceRule } from './informationGain/lib'
import type { LlmClient } from './llm'
import type { TenantContext } from './tenant'

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
  /** Information-gain thresholds for this run (admin global → env → default), plus their version stamp. */
  policy: RunPolicy
  /** The admin's active evidence-domain rules, used to score cited sources. */
  evidenceSources: EvidenceSourceRule[]
  /**
   * The workspace this run writes for: its profile, its active audiences, and
   * (from slices 3 and 4) its positioning and evidence bank. Required, so no
   * stage has to decide what to do without one; tests use
   * `emptyTenantContext()`.
   */
  tenant: TenantContext
  /** Run-scoped provider adapter. Optional for backwards-compatible test contexts. */
  llm?: LlmClient
  /**
   * Stop at `brief_review` after research so a person approves the brief
   * before writing is paid for. Defaults to on; only the onboarding smoke test
   * turns it off, because nobody is there to approve.
   */
  pauseForBrief?: boolean
}

export interface StageOutcome {
  data: Partial<Article>
  status: ArticleStatus
  /**
   * Work that failed without changing the outcome — bookkeeping a stage does
   * alongside its real job. Throwing would cost the article its progress and
   * re-buy every LLM call behind it, but staying silent would hide the failure,
   * so these are logged, counted in the run summary, and stored on the audit row.
   */
  warnings?: string[]
}

export interface Stage {
  name: PipelineStageName
  entryStatus: ArticleStatus
  exitStatus: ArticleStatus
  run(article: Article, ctx: StageContext): Promise<StageOutcome>
}

export interface RunPipelineOptions {
  /** Restrict the run to these articles (the jobs queue runs one content run). */
  articleIds?: number[]
  /** Stages to walk; defaults to the real pipeline. Tests pass their own. */
  stages?: Stage[]
}

/** What one stage did to its batch in a single run. */
export interface StageRunSummary {
  stage: Stage['name']
  /** Articles found at the stage's `entryStatus` with a template assigned. */
  total: number
  failed: number
  /** Articles that advanced but reported a `StageOutcome.warning`. */
  warned: number
}

/** Why one article did not advance, kept so a caller can say so out loud. */
export interface StageFailure {
  articleId: number
  keyword: string
  stage: Stage['name']
  message: string
}

export interface RunPipelineResult {
  articleIds: number[]
  finalStatuses: Record<string, number>
  /** Per-stage batch sizes and failure counts. */
  stages: StageRunSummary[]
  /** Articles that threw, across every stage; `0` means the run was clean. */
  failed: number
  /** One entry per failure, in the order they happened. */
  failures: StageFailure[]
}

/** `"research 2/5, qa 1/3"` — the per-stage counts behind a non-zero exit. */
export function describeFailures(result: Pick<RunPipelineResult, 'stages'>): string {
  return result.stages
    .filter((entry) => entry.failed > 0)
    .map((entry) => `${entry.stage} ${entry.failed}/${entry.total}`)
    .join(', ')
}

/**
 * The whole pipeline as a table. pipeline:run walks it in order; work is
 * selected purely by current status, so re-running converges instead of
 * duplicating work.
 */
export const stages: Stage[] = [researchStage, generateStage, qaStage, informationGainStage]

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
  const stageSummaries: StageRunSummary[] = []
  const failures: StageFailure[] = []
  let totalFailed = 0
  for (const stage of options.stages ?? stages) {
    // `archived` is deliberately part of the entry query rather than a board-only
    // filter: an archived topic still holds a pipeline status, so leaving it out
    // here would let a run pick up work somebody explicitly took off the board.
    const and: Where[] = [
      { status: { equals: stage.entryStatus } },
      { template: { exists: true } },
      { archived: { not_equals: true } },
    ]
    if (options.articleIds?.length) and.push({ id: { in: options.articleIds } })
    const { docs } = await ctx.payload.find({
      collection: 'articles',
      where: { and },
      pagination: false,
      depth: 1,
      sort: 'createdAt',
    })
    console.log(`[${stage.name}] ${docs.length} article(s) at status "${stage.entryStatus}"`)
    let failed = 0
    let warned = 0
    for (const article of docs) {
      // One article's failure — a malformed LLM reply, a dead Payload write —
      // must not take the rest of the batch, or the stages behind it, down with
      // it. The article keeps its current status, so the next run retries it,
      // which is the same convergent-rerun property the whole loop relies on.
      // The counts still come back in the result, so `index.ts` exits non-zero
      // and a scheduled run's alerting sees stuck articles.
      try {
        const outcome = await stage.run(article, ctx)
        processed.add(article.id)
        finalStatusByArticle.set(article.id, outcome.status)
        const warnings = outcome.warnings ?? []
        if (warnings.length > 0) {
          warned += 1
          for (const warning of warnings) {
            console.warn(`[${stage.name}] article ${article.id} warning: ${warning}`)
          }
        }
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
                ...(warnings.length > 0 ? { warnings } : {}),
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
        failures.push({
          articleId: article.id,
          keyword: article.keyword,
          stage: stage.name,
          message,
        })
        console.error(`[${stage.name}] article ${article.id} failed: ${message}`, error)
      }
    }
    if (failed > 0) {
      console.log(
        `[${stage.name}] ${failed} of ${docs.length} article(s) failed and kept status ` +
          `"${stage.entryStatus}"; the next run retries them`,
      )
    }
    stageSummaries.push({ stage: stage.name, total: docs.length, failed, warned })
    totalFailed += failed
  }
  const finalStatuses: Record<string, number> = {}
  for (const status of finalStatusByArticle.values()) {
    finalStatuses[status] = (finalStatuses[status] ?? 0) + 1
  }
  return {
    articleIds: [...processed],
    finalStatuses,
    stages: stageSummaries,
    failed: totalFailed,
    failures,
  }
}
