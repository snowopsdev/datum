import type { CollectionAfterChangeHook, JsonObject } from 'payload'

export type GovernanceAuditContext = {
  actor?: string
  actorType?: 'pipeline' | 'user' | 'system'
  details?: JsonObject
  event?: string
  summary?: string
}

type AuditRequestContext = {
  governanceAudit?: GovernanceAuditContext
}

/** Collections whose changes are recorded in `governance-audit`. Extend the union (and the collection's `relationTo`) to audit more. */
export type GovernanceSubject = 'brand-voices'

const humanize = (event: string): string => event.replace(/_/g, ' ')

/**
 * Builds the `afterChange` hook that mirrors `auditArticleChange` for
 * governance records. Callers annotate `req.context.governanceAudit` to
 * supply the event/summary/details; unannotated edits are still recorded with
 * the authenticated actor and the list of changed fields.
 */
export function auditGovernanceChange(
  relationTo: GovernanceSubject,
  eventPrefix: string,
): CollectionAfterChangeHook {
  return async ({ context, data, doc, operation, previousDoc, req }) => {
    const supplied = (context as AuditRequestContext).governanceAudit
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
        ? `${eventPrefix}_created`
        : previousStatus !== currentStatus
          ? 'status_changed'
          : `${eventPrefix}_updated`)
    const actorType = supplied?.actorType ?? (user ? 'user' : 'system')
    const actor = supplied?.actor ?? user?.email ?? (user?.id != null ? String(user.id) : 'system')
    const changedFields = Object.keys(data ?? {}).filter(
      (field) => !['createdAt', 'updatedAt'].includes(field),
    )

    await req.payload.create({
      collection: 'governance-audit',
      data: {
        subject: { relationTo, value: doc.id },
        event,
        summary: supplied?.summary ?? humanize(event),
        actorType,
        actor,
        ...statusTransition,
        details: supplied?.details ?? { changedFields },
      },
      overrideAccess: true,
      req,
    })

    return doc
  }
}
