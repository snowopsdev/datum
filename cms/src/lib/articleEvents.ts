import type { CollectionAfterChangeHook } from 'payload'

import type { ArticleAuditContext } from './articleAudit'
import { resolveWebhookSettings } from './webhookSettings'

export const ARTICLE_STATUS_EVENT = 'article.status_changed'

/**
 * Emits a webhook job for every status transition, making the state machine
 * observable without polling the admin. Runs beside `auditArticleChange`; the
 * audit row is the durable record, this is the live signal.
 *
 * The event body is derived from doc/previousDoc, not from
 * `context.articleAudit` alone — the context is only seeded by gates and
 * pipeline updates, and a plain admin status edit has neither.
 */
export const emitArticleStatusEvent: CollectionAfterChangeHook = async ({
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  const from = operation === 'create' ? null : ((previousDoc?.status as string | null) ?? null)
  const to = (doc.status as string | null) ?? null
  if (from === to) return doc

  try {
    // Resolving here (one global read per status change) keeps no-op jobs out
    // of the queue entirely; the delivery task re-resolves anyway, so a stale
    // read only costs one skipped delivery, never an unsigned one.
    const settings = resolveWebhookSettings(
      await req.payload.findGlobal({ slug: 'webhook-settings', depth: 0 }),
      process.env,
    )
    if (!settings.enabled) return doc

    const supplied = (context as { articleAudit?: ArticleAuditContext }).articleAudit
    const user = req.user as { email?: string; id?: number | string } | null | undefined
    await req.payload.jobs.queue({
      task: 'webhook-deliver',
      queue: 'webhooks',
      input: {
        event: ARTICLE_STATUS_EVENT,
        body: {
          event: ARTICLE_STATUS_EVENT,
          articleId: doc.id,
          slug: (doc.slug as string | null) ?? null,
          from,
          to,
          actorType: supplied?.actorType ?? (user ? 'user' : 'system'),
          actor:
            supplied?.actor ?? user?.email ?? (user?.id != null ? String(user.id) : 'system'),
          ...(supplied?.pipelineRunId ? { pipelineRunId: supplied.pipelineRunId } : {}),
          occurredAt: new Date().toISOString(),
        },
      },
    })
  } catch (error) {
    // Emission is bookkeeping. Failing the save over it would cost the article
    // its transition (and any LLM work behind it), so log and move on — the
    // same trade `StageOutcome.warnings` makes in the pipeline.
    req.payload.logger.warn(
      `failed to queue ${ARTICLE_STATUS_EVENT} for article ${doc.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  return doc
}
