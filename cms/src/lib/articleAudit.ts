import { auditActor, changedFieldsOf, humanize } from './auditFields'
import type { CollectionAfterChangeHook, JsonObject } from 'payload'

export type ArticleAuditContext = {
  actor?: string
  actorType?: 'pipeline' | 'user' | 'system'
  details?: JsonObject
  event?: string
  pipelineRunId?: string
  stage?: string
  summary?: string
}

type AuditRequestContext = {
  articleAudit?: ArticleAuditContext
}

export const auditArticleChange: CollectionAfterChangeHook = async ({
  context,
  data,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  const supplied = (context as AuditRequestContext).articleAudit
  const user = req.user as { email?: string; id?: number | string } | null | undefined
  const previousStatus = previousDoc?.status as string | undefined
  const currentStatus = doc.status as string | undefined
  const statusTransition =
    operation === 'create'
      ? { toStatus: currentStatus }
      : previousStatus !== currentStatus
        ? { fromStatus: previousStatus, toStatus: currentStatus }
        : {}
  const event =
    supplied?.event ??
    (operation === 'create'
      ? 'article_created'
      : previousStatus !== currentStatus
        ? 'status_changed'
        : 'article_updated')
  const actorType = supplied?.actorType ?? (user ? 'user' : 'system')
  const actor = supplied?.actor ?? auditActor(user)
  const changedFields = changedFieldsOf(data, previousDoc, operation)

  await req.payload.create({
    collection: 'article-audit',
    data: {
      article: doc.id,
      event,
      summary: supplied?.summary ?? humanize(event),
      actorType,
      actor,
      pipelineRunId: supplied?.pipelineRunId,
      stage: supplied?.stage,
      ...statusTransition,
      details: supplied?.details ?? { changedFields },
    },
    overrideAccess: true,
    req,
  })

  return doc
}
