import type { CollectionAfterChangeHook, GlobalAfterChangeHook, JsonObject } from 'payload'

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
export type GovernanceSubject = 'brand-voices' | 'evidence-sources'

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

const pick = (source: JsonObject | undefined, keys: string[]): JsonObject =>
  Object.fromEntries(keys.map((key) => [key, source?.[key] ?? null]))

const IGNORED_GLOBAL_FIELDS = ['createdAt', 'updatedAt', 'globalType', 'id']

/**
 * The Global counterpart of `auditGovernanceChange`. Globals have no id, so the
 * entry records `subjectGlobal` (the slug) instead of a `subject` relationship,
 * and it carries the before/after values of the fields that actually moved —
 * a threshold's old and new value is the whole point of the audit row.
 * Unannotated saves that changed nothing are not recorded at all, because
 * Payload writes the full document on every save of a Global.
 */
export function auditGlobalChange(slug: string, eventPrefix: string): GlobalAfterChangeHook {
  return async ({ context, data, doc, previousDoc, req }) => {
    const supplied = (context as AuditRequestContext).governanceAudit
    const user = req.user as { email?: string; id?: number | string } | null | undefined
    const previous = previousDoc as JsonObject | undefined
    const changedFields = Object.keys(data ?? {}).filter(
      (field) =>
        !IGNORED_GLOBAL_FIELDS.includes(field) &&
        JSON.stringify((data as JsonObject)[field]) !== JSON.stringify(previous?.[field]),
    )
    if (changedFields.length === 0 && !supplied) return doc

    const event = supplied?.event ?? `${eventPrefix}_updated`
    const actorType = supplied?.actorType ?? (user ? 'user' : 'system')
    const actor = supplied?.actor ?? user?.email ?? (user?.id != null ? String(user.id) : 'system')

    await req.payload.create({
      collection: 'governance-audit',
      data: {
        subjectGlobal: slug,
        event,
        summary: supplied?.summary ?? humanize(event),
        actorType,
        actor,
        details: supplied?.details ?? {
          changedFields,
          before: pick(previous, changedFields),
          after: pick(doc as JsonObject, changedFields),
        },
      },
      overrideAccess: true,
      req,
    })

    return doc
  }
}
