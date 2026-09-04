import type { AuditTimelineEntry } from './articleStatus'

export type AuditSource = { kind: 'audit' | 'cost'; recordId: number }
export type AuditSummary = Omit<AuditTimelineEntry, 'details'> & { source: AuditSource }
export type AuditDetailResult = { ok: true; details: unknown } | { ok: false; error: string }
