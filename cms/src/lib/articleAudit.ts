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

const humanize = (event: string): string => event.replace(/_/g, ' ')

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
  const fromStatus = operation === 'create' ? undefined : (previousDoc.status as string | undefined)
  const toStatus = doc.status as string | undefined
  const event =
    supplied?.event ??
    (operation === 'create'
      ? 'article_created'
      : fromStatus !== toStatus
        ? 'status_changed'
        : 'article_updated')
  const actorType = supplied?.actorType ?? (user ? 'user' : 'system')
  const actor = supplied?.actor ?? user?.email ?? (user?.id != null ? String(user.id) : 'system')
  const changedFields = Object.keys(data).filter((field) => !['createdAt', 'updatedAt'].includes(field))

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
      fromStatus,
      toStatus,
      details: supplied?.details ?? { changedFields },
    },
    overrideAccess: true,
    req,
  })

  return doc
}
