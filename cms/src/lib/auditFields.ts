import { sameValue } from './sameValue'

export function changedFieldsOf(
  data: Record<string, unknown> | undefined,
  previousDoc: Record<string, unknown> | undefined,
  operation: 'create' | 'update',
): string[] {
  return Object.keys(data ?? {}).filter(
    (field) =>
      !['createdAt', 'updatedAt'].includes(field) &&
      (operation === 'create' || !sameValue(data?.[field], previousDoc?.[field])),
  )
}

export const humanize = (event: string): string => event.replace(/_/g, ' ')

export function auditActor(
  user: { email?: string | null; id?: number | string } | null | undefined,
): string {
  return user?.email ?? (user?.id != null ? String(user.id) : 'system')
}
