'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { ActivePipelineRunError, createPipelineRun } from '../../lib/createPipelineRun'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'

import { isRunnableStatus } from './articleStatus'
import { type RunArticleDTO, type RunStatusDTO, toRunFailures } from './boardTypes'

const BOARD_PATH = '/admin/ops/articles'

export type BoardActionResult = { ok: true; message: string } | { ok: false; error: string }

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in to manage the board.')
  return { payload, user }
}

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return fallback
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Advance the articles a person ticked on the board, and only those.
 *
 * This is the counterpart to `startContentRunAction`, which buys *new* topics
 * from Ahrefs before running anything. Both end up in `runPipeline`, but they
 * answer different questions: "find me work" versus "do this work". Keeping
 * them apart is the point — a board full of topics somebody chose deliberately
 * should never need a content-gap lookup to move.
 */
export async function runSelectedArticlesAction(input: {
  articleIds: number[]
  confirmLiveCost?: boolean
}): Promise<BoardActionResult> {
  try {
    const { payload, user } = await requireUser()
    const ids = [...new Set(input.articleIds)].filter((id) => Number.isFinite(id) && id > 0)
    if (ids.length === 0) return { ok: false, error: 'Pick at least one article to run.' }

    const setup = await loadWorkspaceSetup(payload)
    const { readiness } = setup
    if (!readiness.runtime.ready) {
      return {
        ok: false,
        error: `Configure the required environment variables: ${readiness.runtime.missing.join(', ')}.`,
      }
    }
    if (!readiness.governance.ready) {
      return { ok: false, error: 'Activate a brand voice before running the pipeline.' }
    }
    if (readiness.mode === 'live' && input.confirmLiveCost !== true) {
      return { ok: false, error: 'Confirm the live provider cost before starting this run.' }
    }

    const { docs } = await payload.find({
      collection: 'articles',
      where: { id: { in: ids } },
      pagination: false,
      limit: ids.length,
      depth: 0,
    })
    if (docs.length === 0) return { ok: false, error: 'Those articles no longer exist.' }

    // A status with no stage waiting on it would be silently dropped by
    // `runPipeline`'s entry-status query, so the run would report success
    // having done nothing. Refuse instead of lying about it.
    const stalled = docs.filter((doc) => !isRunnableStatus(doc.status))
    if (stalled.length > 0) {
      return {
        ok: false,
        error: `${plural(stalled.length, 'article')} cannot be advanced by a run — open ${stalled.length === 1 ? 'it' : 'them'} to decide what happens next.`,
      }
    }
    const untemplated = docs.filter((doc) => !doc.template)
    if (untemplated.length > 0) {
      return {
        ok: false,
        error: `Assign a template to ${plural(untemplated.length, 'article')} first — the pipeline skips articles without one.`,
      }
    }

    // The run row needs one template for its own record; each article is still
    // written against its own, so a mixed selection runs correctly either way.
    const first = docs[0].template
    const templateId = typeof first === 'object' && first ? first.id : Number(first)

    const runId = randomUUID()
    await createPipelineRun(payload, user, {
      runId,
      source: 'selected',
      templateId,
      count: docs.length,
      articleIds: docs.map((doc) => doc.id),
      requestedBy: user.email || String(user.id),
      readiness,
    })

    revalidatePath(BOARD_PATH)
    revalidatePath('/admin')
    return {
      ok: true,
      message: `Started a run for ${plural(docs.length, 'article')}. Progress shows above.`,
    }
  } catch (error) {
    if (error instanceof ActivePipelineRunError) {
      return { ok: false, error: `${error.message} Wait for it to finish before starting another.` }
    }
    return { ok: false, error: errorMessage(error, 'Could not start that run.') }
  }
}

/**
 * Take chosen topics off the board before anything has been spent on them.
 *
 * Archives rather than deletes. A hard delete is not available: `article-audit`
 * rows are append-only (`beforeDelete` throws) and their `article_id` is NOT
 * NULL behind an ON DELETE SET NULL foreign key, so Postgres refuses to remove
 * an article while any audit row points at it — which every article has from
 * the moment it is created. Archiving keeps that record of what was chosen and
 * dropped, and `runPipeline` skips archived articles, so the practical effect
 * is the one asked for: it leaves the board and never runs.
 *
 * Deliberately limited to `topic_selected`. Past that point an article has
 * research, a draft and cost behind it, and setting that aside is a different
 * decision than un-picking a topic — it belongs on the article's own page.
 */
export async function removeTopicsAction(articleIds: number[]): Promise<BoardActionResult> {
  try {
    const { payload, user } = await requireUser()
    const ids = [...new Set(articleIds)].filter((id) => Number.isFinite(id) && id > 0)
    if (ids.length === 0) return { ok: false, error: 'Pick at least one topic to remove.' }

    const { docs } = await payload.find({
      collection: 'articles',
      where: { id: { in: ids } },
      pagination: false,
      limit: ids.length,
      depth: 0,
    })
    const started = docs.filter((doc) => doc.status !== 'topic_selected')
    if (started.length > 0) {
      return {
        ok: false,
        error: `${plural(started.length, 'article')} has already been worked on and cannot be removed here. Only topics that have not started are removable.`,
      }
    }
    if (docs.length === 0) return { ok: false, error: 'Those topics no longer exist.' }

    for (const doc of docs) {
      await payload.update({
        collection: 'articles',
        id: doc.id,
        data: { archived: true },
        user,
        overrideAccess: false,
        context: {
          articleAudit: {
            actor: typeof user.email === 'string' ? user.email : String(user.id),
            actorType: 'user' as const,
            event: 'topic_removed_from_board',
            summary: 'Topic archived before any work was done on it',
            details: { keyword: doc.keyword },
          },
        },
      })
    }

    revalidatePath(BOARD_PATH)
    revalidatePath('/admin/ops/topics')
    return {
      ok: true,
      message: `Removed ${plural(docs.length, 'topic')} from the board. ${docs.length === 1 ? 'It is' : 'They are'} archived, not deleted — still in Article records if you want ${docs.length === 1 ? 'it' : 'them'} back.`,
    }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not remove those topics.') }
  }
}

/**
 * The most recent run, for the board's status panel.
 *
 * Polled from the client while a run is in flight, so it stays deliberately
 * small: no article bodies, no scorecards, just what a person needs to answer
 * "is it still going, and did it work".
 */
export async function latestRunAction(): Promise<RunStatusDTO | null> {
  try {
    const { payload } = await requireUser()
    const { docs } = await payload.find({
      collection: 'pipeline-runs',
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    })
    const run = docs[0]
    if (!run) return null
    const started = run.startedAt ?? run.createdAt

    // Only while it matters: a settled run's articles are already on the board,
    // and this action is polled from every admin page.
    const active = run.status === 'queued' || run.status === 'running'
    const ids = Array.isArray(run.articles)
      ? run.articles.flatMap((a) => (typeof a === 'number' ? [a] : a?.id ? [a.id] : []))
      : []
    let articles: RunArticleDTO[] = []
    if (active && ids.length > 0) {
      const found = await payload.find({
        collection: 'articles',
        where: { id: { in: ids } },
        pagination: false,
        limit: ids.length,
        depth: 0,
      })
      articles = found.docs.map((d) => ({ id: d.id, keyword: d.keyword, status: d.status }))
    }
    return {
      runId: run.runId,
      status: run.status,
      mode: run.mode,
      source: run.source,
      startedLabel: started ? new Date(started).toLocaleTimeString() : 'just now',
      startedAtIso: started ? new Date(started).toISOString() : null,
      articleCount: ids.length,
      articles,
      completedAtIso: run.completedAt ? new Date(run.completedAt).toISOString() : null,
      finalStatuses:
        run.finalStatuses && typeof run.finalStatuses === 'object' && !Array.isArray(run.finalStatuses)
          ? (run.finalStatuses as Record<string, number>)
          : {},
      failures: toRunFailures(run.warnings),
      errorSummary: run.errorSummary ?? null,
    }
  } catch {
    return null
  }
}
