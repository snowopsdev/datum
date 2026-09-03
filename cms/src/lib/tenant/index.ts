/**
 * Tenant context — the workspace's own facts, shared by the admin and the
 * pipeline. Everything under `lib/tenant/` is dependency-free so
 * `pipeline/src/tenant.ts` can re-export this barrel wholesale.
 */

import { createHash } from 'node:crypto'

import type { EvidenceBankContent } from './evidenceBank'
import { type IcpContent, icpContentOf } from './icp'
import type { PositioningContent } from './positioning'
import { resolveWorkspaceProfile, type ResolvedWorkspaceProfile } from './workspaceProfile'

export * from './confidence'
export * from './evidenceBank'
export * from './icp'
export * from './positioning'
export * from './sitePages'
export * from './workspaceProfile'

/**
 * Everything a run knows about the workspace it writes for, resolved once at
 * the start and passed down as one value.
 *
 * It is assembled by `loadTenantContext` (pipeline) and handed to every stage
 * on `StageContext.tenant`. `positioning` and `evidenceBank` are null when the
 * workspace has saved none, and every consumer reads that as "omit that block".
 */
export interface TenantContext {
  profile: ResolvedWorkspaceProfile
  /** Active ICPs, primary first. Empty when none is active. */
  icps: IcpContent[]
  positioning: PositioningContent | null
  evidenceBank: EvidenceBankContent | null
  /**
   * The date the run started, as `YYYY-MM-DD`. Anything that expires is judged
   * against this rather than `Date.now()`, so a prompt snapshot can be
   * reproduced from the row that recorded it.
   */
  asOf: string
}

export function emptyTenantContext(asOf = '2026-01-01'): TenantContext {
  return {
    profile: resolveWorkspaceProfile(null, {}),
    icps: [],
    positioning: null,
    evidenceBank: null,
    asOf,
  }
}

/** The id on an `article.icp` relationship, populated or not. */
function icpIdOf(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    if (typeof id === 'number' || typeof id === 'string') return id
  }
  return null
}

/**
 * Which audience this article is written for.
 *
 * The article's own relationship wins, but only when it still points at an
 * active ICP: an audience that was archived after the piece was created must
 * not keep steering it, and silently writing for an archived reader is worse
 * than falling back to the primary. Falls back to the primary, then to
 * whatever is first (the loader sorts primary-first, so "first" is a stable
 * answer), then to null for a workspace with no audiences at all.
 */
export function selectIcp(
  tenant: TenantContext,
  article: { icp?: unknown } | null | undefined,
): IcpContent | null {
  const wanted = icpIdOf(article?.icp)
  if (wanted != null) {
    const match = tenant.icps.find((icp) => icp.id != null && String(icp.id) === String(wanted))
    if (match) return match
  }
  return tenant.icps.find((icp) => icp.primary) ?? tenant.icps[0] ?? null
}

/**
 * A stable hash of everything in the tenant context that changes what a run
 * produces. It joins `configFingerprint`, so editing an audience stales a
 * verification run the way editing the brand voice does.
 *
 * Ids and `updatedAt` rather than the content itself: the readiness evaluator
 * never loads full ICP documents, and a row cannot change without its
 * timestamp moving.
 */
export function tenantFingerprint(input: {
  profile: Pick<ResolvedWorkspaceProfile, 'targetDomain' | 'competitors'>
  icps: { id: number | string; updatedAt?: string; primary?: boolean }[]
  /** The `positioning` global's timestamp. A global has no id to hash instead. */
  positioningUpdatedAt?: string | null
  /** The `evidence-bank` global's timestamp, for the same reason. */
  evidenceBankUpdatedAt?: string | null
}): string {
  const projection = {
    target: input.profile.targetDomain,
    competitors: input.profile.competitors.map((competitor) => competitor.domain),
    icps: input.icps
      .map((icp) => [String(icp.id), icp.updatedAt ?? '', icp.primary === true] as const)
      .sort((a, b) => a[0].localeCompare(b[0])),
    positioning: input.positioningUpdatedAt ?? null,
    evidenceBank: input.evidenceBankUpdatedAt ?? null,
  }
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex')
}

/** Payload documents in, primary-first `IcpContent` out. */
export function icpsFromDocs(docs: unknown[]): IcpContent[] {
  return docs
    .map(icpContentOf)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name))
}
