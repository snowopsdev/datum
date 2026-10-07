import type { Payload } from 'payload'

import { icpsFromDocs, positioningContentOf, resolveWorkspaceProfile } from './tenant'

/**
 * The active audiences, primary first and then alphabetical, so `icps[0]` is a
 * stable answer for a workspace that has somehow ended up with no primary.
 *
 * The one query both the pipeline's `loadTenantContext` and admin discovery use,
 * so the audiences a topic is scored against are the audiences a run writes for.
 */
export async function findActiveIcps(payload: Payload) {
  const result = await payload.find({
    collection: 'icps',
    where: { status: { equals: 'active' } },
    sort: ['-primary', 'name'],
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return icpsFromDocs(result.docs)
}

/**
 * What topic discovery scores against: the profile, the active audiences, and
 * the positioning. Setup assist keeps its richer loader (it also needs the
 * brand voice, the evidence bank, and draft audiences).
 */
export async function loadTenantContextCms(payload: Payload, mode: 'mock' | 'live') {
  const [profileDoc, icps, positioningDoc] = await Promise.all([
    payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true }),
    findActiveIcps(payload),
    payload.findGlobal({ slug: 'positioning', depth: 0, overrideAccess: true }),
  ])
  return {
    profile: resolveWorkspaceProfile(profileDoc, process.env, { mockDefault: mode === 'mock' }),
    icps,
    positioning: positioningContentOf(positioningDoc),
  }
}
