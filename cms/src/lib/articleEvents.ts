import { auditActor } from './auditFields'
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
      await req.payload.findGlobal({ slug: 'webhook-settings', depth: 0, req }),
      process.env,
    )
    if (!settings.enabled) return doc

    const supplied = (context as { articleAudit?: ArticleAuditContext }).articleAudit
    const user = req.user as { email?: string; id?: number | string } | null | undefined
    await req.payload.jobs.queue({
      req,
      task: 'webhook-deliver',
      queue: 'webhooks',
      input: {
        event: ARTICLE_STATUS_EVENT,
        body: {
          event: ARTICLE_STATUS_EVENT,
          articleId: doc.id,
          slug: (doc.slug as string | null) ?? null,
          // The slug the article had before this update. An unpublish that
          // renames the slug in the same save would otherwise leave the old
          // slug's cached page serving withdrawn content until ISR expiry.
          previousSlug: (previousDoc?.slug as string | null) ?? null,
          from,
          to,
          actorType: supplied?.actorType ?? (user ? 'user' : 'system'),
          actor: supplied?.actor ?? auditActor(user),
          ...(supplied?.pipelineRunId ? { pipelineRunId: supplied.pipelineRunId } : {}),
          occurredAt: new Date().toISOString(),
        },
      },
    })
  } catch (error) {
    // Queueing belongs to the save transaction: failure aborts the transition
    // so no article can commit a status without its corresponding event.
    req.payload.logger.warn(
      `failed to queue ${ARTICLE_STATUS_EVENT} for article ${doc.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw error
  }
  return doc
}
