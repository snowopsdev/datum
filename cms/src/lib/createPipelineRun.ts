import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type TypedUser } from 'payload'

import { activeRunIdForArticles } from './activeRuns'
import type { PipelineRun } from '../payload-types'

import type { WorkspaceReadiness } from './workspaceReadiness'

export interface CreatePipelineRunInput {
  source: 'admin' | 'selected'
  templateId: number
  count: number
  requestedBy: string
  readiness: WorkspaceReadiness
  runId: string
  /**
   * The articles a `selected` run should advance, attached at creation rather
   * than discovered by the task. Every other source creates its own articles,
   * so this is empty for them.
   */
  articleIds?: number[]
}

export class ActivePipelineRunError extends Error {
  constructor(readonly runId: string) {
    super(`Run ${runId} is already in progress.`)
    this.name = 'ActivePipelineRunError'
  }
}

/**
 * An active run already lists one of the articles, so a second run over the
 * top would write to the same article twice. A subclass so callers that treat
 * "a run is in the way" as a non-failure keep doing so.
 */
export class ArticleInActiveRunError extends ActivePipelineRunError {
  constructor(runId: string, selected: number) {
    super(runId)
    // Only one active run is looked up, so this cannot say how many of a
    // selection it holds — just that the selection overlaps it.
    this.message = `${selected === 1 ? 'That article is' : 'Some of those articles are'} already in run ${runId}. Wait for it to finish.`
  }
}

type LockedRequest = Awaited<ReturnType<typeof createLocalReq>>

/**
 * Run `fn` inside the run-creation transaction, holding the advisory lock that
 * serialises every launch decision — the CMS's and the CLI's.
 */
async function withRunCreationLock<T>(
  payload: Payload,
  user: TypedUser | null,
  fn: (req: LockedRequest) => Promise<T>,
): Promise<T> {
  // The advisory lock serializes launch decisions. READ COMMITTED gives a
  // waiter a fresh snapshot after acquiring it; SERIALIZABLE would retain the
  // snapshot from before the wait and reject valid queued selected runs.
  const transactionID = await payload.db.beginTransaction({ isolationLevel: 'read committed' })
  if (transactionID == null)
    throw new Error('The database could not start a content-run transaction.')

  try {
    const req = await createLocalReq({ req: { transactionID }, user: user ?? undefined }, payload)
    const transaction = (
      payload.db as typeof payload.db & {
        sessions: Record<string, { db: { execute: (query: unknown) => Promise<unknown> } }>
      }
    ).sessions[String(transactionID)]?.db
    if (!transaction) throw new Error('The content-run transaction session is unavailable.')

    // Serialize the predicate check and insert. This transaction-scoped lock is
    // automatically released on commit or rollback, including process errors.
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(424242, 434343)`)
    const value = await fn(req)
    await payload.db.commitTransaction(transactionID)
    return value
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}

/** The active run, if any: queued or running. Read under the creation lock. */
async function findActiveRun(payload: Payload, req: LockedRequest) {
  const active = await payload.find({
    collection: 'pipeline-runs',
    where: { status: { in: ['queued', 'running'] } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return active.docs[0] ?? null
}

/** What a run row records about the workspace it wrote for. */
function configSnapshotOf(readiness: WorkspaceReadiness, templateId: number | null) {
  return {
    mode: readiness.mode,
    requiredEnvironment: readiness.runtime.missing,
    activeVoiceId: readiness.governance.activeVoiceId,
    templateId,
    // The workspace this run wrote for. Kept on the row because the
    // audience and the target domain decide what every prompt said, and
    // an article's output stops being explainable the moment they change.
    tenant: {
      targetDomain: readiness.tenant.profile.targetDomain,
      competitorCount: readiness.tenant.profile.competitorCount,
      icpId: readiness.tenant.icps.primaryId,
      icpCount: readiness.tenant.icps.count,
      positioning: readiness.tenant.positioning.status,
      // The counts, not the claims: a snapshot that carried the bank's
      // text would grow without bound and duplicate the audit trail. The
      // counts are enough to explain why a draft could or could not state
      // a first-party fact when this run wrote it.
      evidenceBank: readiness.tenant.evidenceBank,
    },
    models: readiness.content.models.map(
      ({ stage, model, source, provider, requirement, envVar, configured }) => ({
        stage,
        model,
        source,
        provider,
        requirement,
        envVar,
        configured,
      }),
    ),
  }
}

/** Atomically create the run record and its Payload job. */
export async function createPipelineRun(
  payload: Payload,
  user: TypedUser,
  input: CreatePipelineRunInput,
): Promise<void> {
  await withRunCreationLock(payload, user, async (req) => {
    // Recheck overlap under the creation lock using this transaction. An
    // earlier UI/queue check can race another request that has not committed.
    if (input.articleIds?.length) {
      const activeRunId = await activeRunIdForArticles(payload, user, input.articleIds, req)
      if (activeRunId) throw new ArticleInActiveRunError(activeRunId, input.articleIds.length)
    }

    const active = await findActiveRun(payload, req)
    // Runs started by creating a piece or approving a brief are implicit —
    // nobody is watching a button — so two in a row must queue, not fail. The
    // job task already serialises on the `content-pipeline` concurrency key,
    // so queued runs execute one at a time. A discovery run keeps the
    // one-at-a-time rule too: it creates articles, and two at once would
    // double-buy topics.
    if (active && input.source !== 'selected') {
      throw new ActivePipelineRunError(active.runId)
    }

    const requestedCount =
      input.source === 'selected'
        ? Math.max(1, Math.min(50, input.articleIds?.length ?? 0))
        : Math.max(1, Math.min(5, input.count))
    await payload.create({
      collection: 'pipeline-runs',
      overrideAccess: true,
      req,
      data: {
        runId: input.runId,
        source: input.source,
        status: 'queued',
        mode: input.readiness.mode,
        template: input.templateId,
        requestedCount,
        ...(input.articleIds?.length ? { articles: input.articleIds } : {}),
        configFingerprint: input.readiness.configFingerprint,
        configSnapshot: configSnapshotOf(input.readiness, input.templateId),
        requestedBy: input.requestedBy,
      },
    })
    await payload.jobs.queue({
      task: 'content-run',
      queue: 'content',
      input: { runId: input.runId },
      overrideAccess: true,
      req,
    })
  })
}

export interface CreateCliRunInput {
  runId: string
  mode: 'mock' | 'live'
  readiness: WorkspaceReadiness
  /** Every article the CLI will advance, so other runs refuse them. */
  articleIds: number[]
  requestedBy: string
}

/**
 * Register a `pipeline run` CLI invocation as a `running` run.
 *
 * Same lock and the same one-active-run rule as an admin run: the CLI walks
 * every waiting article, so it refuses while any run is queued or running, and
 * listing its articles on the row makes later admin and selected runs refuse
 * them in turn. There is no job — the CLI executes the run itself — so the row
 * is created already `running`, with the heartbeat the recovery task reads.
 */
export async function createCliRun(
  payload: Payload,
  input: CreateCliRunInput,
): Promise<PipelineRun> {
  return withRunCreationLock(payload, null, async (req) => {
    const active = await findActiveRun(payload, req)
    if (active) throw new ActivePipelineRunError(active.runId)
    const now = new Date().toISOString()
    return payload.create({
      collection: 'pipeline-runs',
      overrideAccess: true,
      depth: 0,
      req,
      data: {
        runId: input.runId,
        source: 'cli',
        status: 'running',
        mode: input.mode,
        // The schema's ceiling; the row's `articles` is the real list.
        requestedCount: Math.max(1, Math.min(50, input.articleIds.length)),
        ...(input.articleIds.length ? { articles: input.articleIds } : {}),
        configFingerprint: input.readiness.configFingerprint,
        configSnapshot: configSnapshotOf(input.readiness, null),
        requestedBy: input.requestedBy,
        startedAt: now,
        heartbeatAt: now,
      },
    })
  })
}
