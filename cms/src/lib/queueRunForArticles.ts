import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import type { Payload, TypedUser } from 'payload'

import { isRunnableStatus } from '../components/ops/articleStatus'
import type { Article } from '../payload-types'

import { createPipelineRun } from './createPipelineRun'
import type { WorkspaceReadiness } from './workspaceReadiness'

/**
 * Its own copy, because this module deliberately does not import from
 * `boardActions.ts` — see below. One line of counting is a cheaper duplicate
 * than an import cycle between a helper and the server action that calls it.
 */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The board, and the dashboard that shows the run banner. */
const AFFECTED_PATHS = ['/admin/ops/content', '/admin']

/**
 * Why this workspace cannot start a run right now, in the words an operator
 * acts on — or `null` when it can.
 *
 * One gate for every entry point. The board's Run button and the reviewer's
 * reset/regenerate actions ask the same question and must give the same
 * answer, and when they each owned a copy the three sentences drifted (the
 * board's governance refusal still named the brand voice long after
 * governance became three assets). `confirmLiveCost` is the only thing the
 * callers differ on, so it is a parameter: `true` means a person has been
 * shown what a live run costs and agreed to it.
 *
 * Deliberately separate from `queueRunForArticles`: readiness is about the
 * workspace, the refusals there are about the articles, and only the caller
 * knows whether it collected a live-cost confirmation.
 */
export function gateRunReadiness(
  readiness: WorkspaceReadiness,
  confirmLiveCost?: boolean,
): string | null {
  if (!readiness.runtime.ready) {
    return `Configure the required environment variables: ${readiness.runtime.blockers.join(', ')}.`
  }
  if (!readiness.governance.ready) {
    return `Finish setup before running the pipeline: ${readiness.governance.problems.join('; ')}.`
  }
  if (readiness.mode === 'live' && confirmLiveCost !== true) {
    return 'Confirm the live provider cost before starting this run.'
  }
  return null
}

/**
 * Queue a run for articles that already exist — the one way to do it.
 *
 * The board's Run button (`runSelectedArticlesAction`) and the reviewer's
 * reset/regenerate actions (`actions.ts`) both end up here, so an article
 * queued from an article page and one queued from the board get the same
 * refusals, the same `selected` source and the same run row. Callers own the
 * readiness decision (only they know whether a live-cost confirmation was
 * asked for) and the article load; this owns everything from "these documents,
 * that readiness" to a queued job.
 *
 * Lives in `lib/` rather than beside its callers on purpose. Every export of a
 * `'use server'` module is a server action Next.js registers as a
 * client-invocable endpoint, and this function does no authentication of its
 * own — its callers do, before they load the documents they hand it. Keeping
 * it out of that surface means it can only be reached through one of them.
 *
 * Refusals throw rather than returning a result union: every caller already
 * has a catch that turns a message into its own shape, and a second union here
 * would only be unwrapped and rewrapped at each one.
 */
export async function queueRunForArticles(
  payload: Payload,
  user: TypedUser,
  docs: Article[],
  readiness: WorkspaceReadiness,
): Promise<{ runId: string }> {
  if (docs.length === 0) throw new Error('Those articles no longer exist.')

  // The pipeline passes archived articles over at selection, so a run queued
  // for one would report success having done nothing. Say so up front.
  const archived = docs.filter((doc) => doc.archived === true)
  if (archived.length > 0) {
    throw new Error(
      `${plural(archived.length, 'article')} ${archived.length === 1 ? 'is' : 'are'} archived — unarchive ${archived.length === 1 ? 'it' : 'them'} before running.`,
    )
  }

  // A status with no stage waiting on it would be silently dropped by
  // `runPipeline`'s entry-status query, so the run would report success
  // having done nothing. Refuse instead of lying about it.
  const stalled = docs.filter((doc) => !isRunnableStatus(doc.status))
  if (stalled.length > 0) {
    throw new Error(
      `${plural(stalled.length, 'article')} cannot be advanced by a run — open ${stalled.length === 1 ? 'it' : 'them'} to decide what happens next.`,
    )
  }
  const untemplated = docs.filter((doc) => !doc.template)
  if (untemplated.length > 0) {
    throw new Error(
      `Assign a template to ${plural(untemplated.length, 'article')} first — the pipeline skips articles without one.`,
    )
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

  for (const path of AFFECTED_PATHS) revalidatePath(path)
  return { runId }
}
