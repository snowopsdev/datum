import type { Payload } from 'payload'

import {
  emptyTenantContext,
  evidenceBankContentOf,
  evidenceBankSummary,
  icpsFromDocs,
  isEvidenceBankEmpty,
  positioningContentOf,
  positioningStatus,
  resolveWorkspaceProfile,
  type ResolvedWorkspaceProfile,
  type TenantContext,
  type WorkspaceProfileDoc,
} from '../../cms/src/lib/tenant'

import { config } from './config'

// One import site for stage code: the shared helpers live in the CMS lib so the
// admin UI, readiness, and this pipeline resolve the workspace identically.
export * from '../../cms/src/lib/tenant'

/**
 * The workspace profile for this run: the admin global, falling back to
 * `TARGET_DOMAIN` / `COMPETITOR_DOMAINS`, falling back (in mock mode) to the
 * demo workspace.
 *
 * This is also where `config.ts`'s old "TARGET_DOMAIN is required when
 * AHREFS_API_KEY is set" guard lives now. It has to be here rather than at
 * import time, because the answer depends on a database row: a live run whose
 * domain comes from the global must not be refused, and a live run with an
 * Ahrefs key and no domain anywhere must not silently research the wrong site.
 */
export async function loadWorkspaceProfile(
  payload: Payload,
  mode: 'mock' | 'live',
): Promise<ResolvedWorkspaceProfile> {
  const doc = (await payload.findGlobal({
    slug: 'workspace-profile',
    depth: 0,
    overrideAccess: true,
  })) as WorkspaceProfileDoc
  const profile = resolveWorkspaceProfile(doc, process.env, { mockDefault: mode === 'mock' })
  if (mode === 'live' && config.ahrefsApiKey && !profile.targetDomain) {
    throw new Error(
      'A target domain is required when AHREFS_API_KEY is set. Set it on the Workspace global ' +
        'or in TARGET_DOMAIN.',
    )
  }
  console.log(
    `[pipeline] workspace: ${profile.targetDomain ?? 'no target domain'} ` +
      `(${profile.source.targetDomain}), ${profile.competitors.length} competitor(s) ` +
      `(${profile.source.competitors})`,
  )
  return profile
}

/**
 * Everything the run knows about the workspace, resolved once.
 *
 * Loaded together rather than per stage so every prompt in one run sees the
 * same tenant: an audience activated halfway through a batch must not change
 * what the second article is written against, or the cost-log request
 * snapshots stop explaining each other.
 *
 * Positioning and the evidence bank are loaded but stay null while nothing has
 * been saved: a never-filled global is not a position and not a bank, and
 * sending its empty headings would teach the writer that inventing one is
 * expected. Every consumer reads null as "omit that block".
 */
export async function loadTenantContext(
  payload: Payload,
  opts: { mode: 'mock' | 'live'; asOf?: string },
): Promise<TenantContext> {
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10)
  const [profile, icpResult, positioningDoc, evidenceBankDoc] = await Promise.all([
    loadWorkspaceProfile(payload, opts.mode),
    payload.find({
      collection: 'icps',
      where: { status: { equals: 'active' } },
      // Primary first, then alphabetical, so `icps[0]` is a stable answer for
      // a workspace that has somehow ended up with no primary at all.
      sort: ['-primary', 'name'],
      pagination: false,
      depth: 0,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'positioning', depth: 0, overrideAccess: true }),
    payload.findGlobal({ slug: 'evidence-bank', depth: 0, overrideAccess: true }),
  ])
  const icps = icpsFromDocs(icpResult.docs)
  const primary = icps.find((icp) => icp.primary)
  console.log(
    `[pipeline] audiences: ${icps.length} active` +
      (primary ? `, primary "${primary.name}"` : ', no primary'),
  )
  const positioning = positioningContentOf(positioningDoc)
  const status = positioningStatus(positioning)
  console.log(`[pipeline] positioning: ${status}`)
  const evidenceBank = evidenceBankContentOf(evidenceBankDoc)
  const summary = evidenceBankSummary(evidenceBank, asOf)
  console.log(
    `[pipeline] evidence bank: ${summary.usable} usable claim(s), ${summary.facts} fact(s), ` +
      `${summary.expired} expired, ${summary.rejected} rejected (as of ${asOf})`,
  )
  return {
    ...emptyTenantContext(asOf),
    profile,
    icps,
    positioning: status === 'missing' ? null : positioning,
    evidenceBank: isEvidenceBankEmpty(evidenceBank) ? null : evidenceBank,
  }
}
