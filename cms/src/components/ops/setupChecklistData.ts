import type { Payload } from 'payload'

import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { formatAuditTimestamp } from './articleStatus'
import type { SetupChecklistData } from './SetupChecklist'

/**
 * Everything the setup hub renders, gathered once.
 *
 * `/admin` and `/admin/ops/setup` show the same five rows, so they load them
 * the same way rather than each deciding what a row says. Readiness supplies
 * the states; the two extra reads are for the two names a person recognises —
 * the active voice and the primary audience — which readiness only tracks by
 * id, and for the site-page crawl, which lives on the profile global.
 *
 * The fetched-at stamp is formatted here, on the server, in UTC. A relative
 * "2 h ago" computed in the browser would disagree with the server's own
 * render and hydrate badly, and this page is opened, read, and left.
 */
export async function loadSetupChecklistData(payload: Payload): Promise<SetupChecklistData> {
  const [setup, profileDoc] = await Promise.all([
    loadWorkspaceSetup(payload),
    payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true }),
  ])
  const { governance, mode, tenant } = setup.readiness

  let voiceName: string | null = null
  if (governance.activeVoiceId !== null) {
    try {
      const voice = await payload.findByID({
        collection: 'brand-voices',
        id: governance.activeVoiceId,
        depth: 0,
        overrideAccess: true,
      })
      voiceName = voice.name ?? null
    } catch {
      // An id that no longer resolves is not worth failing the page for: the
      // row still says a voice is active, which is what readiness decided.
      voiceName = null
    }
  }

  const sitePages = Array.isArray((profileDoc as { sitePages?: unknown }).sitePages)
    ? ((profileDoc as { sitePages: unknown[] }).sitePages.length as number)
    : 0
  const fetchedAt = (profileDoc as { sitePagesFetchedAt?: string | null }).sitePagesFetchedAt ?? null

  return {
    mode,
    ready: governance.ready,
    voice: { name: voiceName, active: governance.activeVoiceId !== null },
    workspace: {
      ready: tenant.profile.ready,
      targetDomain: tenant.profile.targetDomain,
      source: tenant.profile.source.targetDomain,
      competitorCount: tenant.profile.competitorCount,
      sitePages,
      sitePagesFetchedLabel: fetchedAt ? formatAuditTimestamp(fetchedAt) : null,
    },
    audiences: {
      ready: tenant.icps.ready,
      count: tenant.icps.count,
      // The same fallback readiness makes: when no active audience carries the
      // flag — one was made primary and then archived — the first is what a
      // new piece is written for, so that is the name to show.
      primaryName: setup.icps.find((icp) => icp.primary)?.name ?? setup.icps[0]?.name ?? null,
    },
    positioning: tenant.positioning,
    evidence: {
      status: tenant.evidenceBank.status,
      usable: tenant.evidenceBank.usable,
      expired: tenant.evidenceBank.expired,
      rejected: tenant.evidenceBank.rejected,
      facts: tenant.evidenceBank.facts,
    },
  }
}
