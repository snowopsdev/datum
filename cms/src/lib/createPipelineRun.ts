import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type TypedUser } from 'payload'

import type { WorkspaceReadiness } from './workspaceReadiness'

export interface CreatePipelineRunInput {
  source: 'onboarding' | 'admin' | 'selected'
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

/** Atomically create the run record and its Payload job. */
export async function createPipelineRun(
  payload: Payload,
  user: TypedUser,
  input: CreatePipelineRunInput,
): Promise<void> {
  const transactionID = await payload.db.beginTransaction({ isolationLevel: 'serializable' })
  if (transactionID == null)
    throw new Error('The database could not start a content-run transaction.')

  try {
    const req = await createLocalReq({ req: { transactionID }, user }, payload)
    const transaction = (
      payload.db as typeof payload.db & {
        sessions: Record<string, { db: { execute: (query: unknown) => Promise<unknown> } }>
      }
    ).sessions[String(transactionID)]?.db
    if (!transaction) throw new Error('The content-run transaction session is unavailable.')

    // Serialize the predicate check and insert. This transaction-scoped lock is
    // automatically released on commit or rollback, including process errors.
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(424242, 434343)`)

    const active = await payload.find({
      collection: 'pipeline-runs',
      where: { status: { in: ['queued', 'running'] } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    // Runs started by creating a piece or approving a brief are implicit —
    // nobody is watching a button — so two in a row must queue, not fail. The
    // job task already serialises on the `content-pipeline` concurrency key,
    // so queued runs execute one at a time. Discovery and onboarding runs keep
    // the one-at-a-time rule: both create articles, and two at once would
    // double-buy topics.
    if (active.docs[0] && input.source !== 'selected') {
      throw new ActivePipelineRunError(active.docs[0].runId)
    }

    const requestedCount =
      input.source === 'onboarding'
        ? 1
        : input.source === 'selected'
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
        configSnapshot: {
          mode: input.readiness.mode,
          requiredEnvironment: input.readiness.runtime.missing,
          activeVoiceId: input.readiness.governance.activeVoiceId,
          templateId: input.templateId,
          // The workspace this run wrote for. Kept on the row because the
          // audience and the target domain decide what every prompt said, and
          // an article's output stops being explainable the moment they change.
          tenant: {
            targetDomain: input.readiness.tenant.profile.targetDomain,
            competitorCount: input.readiness.tenant.profile.competitorCount,
            icpId: input.readiness.tenant.icps.primaryId,
            icpCount: input.readiness.tenant.icps.count,
            positioning: input.readiness.tenant.positioning.status,
            // The counts, not the claims: a snapshot that carried the bank's
            // text would grow without bound and duplicate the audit trail. The
            // counts are enough to explain why a draft could or could not state
            // a first-party fact when this run wrote it.
            evidenceBank: input.readiness.tenant.evidenceBank,
          },
          models: input.readiness.content.models.map(
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
        },
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
    await payload.db.commitTransaction(transactionID)
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID)
    throw error
  }
}
