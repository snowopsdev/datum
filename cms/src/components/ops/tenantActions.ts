'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import { BRAND_VOICE_FIXTURE } from '../../lib/brandVoiceFixture'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import {
  evidenceBankFixtureDoc,
  ICP_FIXTURE,
  ICP_FIXTURE_SECONDARY,
  positioningFixtureDoc,
  WORKSPACE_PROFILE_FIXTURE,
} from '../../lib/tenant/fixtures'
import {
  type EvidenceBankContent,
  evidenceBankContentOf,
  type IcpContent,
  icpCompletenessProblems,
  icpContentOf,
  isEvidenceBankEmpty,
  normaliseDomain,
  type PositioningContent,
  positioningCompletenessProblems,
  positioningContentOf,
  positioningStatus,
  resolveWorkspaceProfile,
  workspaceProfileProblems,
} from '../../lib/tenant'
import { modeFromEnv } from '../../lib/workspaceReadiness'
import type { EvidenceBankInput, WorkspaceProfileInput } from './setupTypes'

export type TenantActionResult = { ok: true } | { ok: false; error: string }
/** A save that succeeded, plus what is still missing from the saved asset. */
export type SaveResult = { ok: true; problems: string[] } | { ok: false; error: string }

const HUB_PATH = '/admin/ops/setup'

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in first.')
  return { payload, user }
}

/**
 * The audit annotation every save carries.
 *
 * `auditGovernanceChange` and `auditGlobalChange` read this off the request
 * context, which is how a governance row gets an actor and a sentence rather
 * than a bare field diff.
 */
function governanceAuditContext(
  user: { email?: string | null; id: number | string },
  event: string,
  summary: string,
  details?: Record<string, unknown>,
) {
  return {
    governanceAudit: {
      actor: typeof user.email === 'string' ? user.email : String(user.id),
      actorType: 'user' as const,
      event,
      summary,
      details,
    },
  }
}

/** A hook's `APIError` message is the sentence the operator needs; keep it. */
function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return e.message
  }
  return fallback
}

/** Payload rejects `''` for a date column; an unset day is null. */
const dateOrNull = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

// ---------------------------------------------------------------------------
// Workspace profile
// ---------------------------------------------------------------------------

/**
 * Save the workspace profile from the setup editor.
 *
 * Domains are normalised on the way in rather than validated: an operator
 * pastes `https://Acme.com/pricing`, and rejecting that would teach them to
 * mistrust the field instead of telling them what it wanted. A row whose
 * domain is not a domain at all is dropped, which the returned problems then
 * report as a missing competitor.
 *
 * `sitePages` is deliberately untouched — it belongs to `refreshSitePagesAction`
 * — so saving the form never silently discards a crawl.
 */
export async function saveWorkspaceProfileAction(
  input: WorkspaceProfileInput,
): Promise<SaveResult> {
  try {
    const { payload, user } = await requireUser()
    const competitors = input.competitors
      .map((row) => ({ domain: normaliseDomain(row.domain), name: (row.name ?? '').trim() }))
      .filter((row): row is { domain: string; name: string } => row.domain !== null)
    const seen = new Set<string>()
    const deduped = competitors.filter((row) => {
      if (seen.has(row.domain)) return false
      seen.add(row.domain)
      return true
    })
    const targetDomain = normaliseDomain(input.targetDomain) ?? ''
    const data = {
      companyName: (input.companyName ?? '').trim(),
      targetDomain,
      competitors: deduped.map((row) => ({ domain: row.domain, name: row.name || row.domain })),
      siteNotes: (input.siteNotes ?? '').trim(),
    }
    const doc = await payload.updateGlobal({
      slug: 'workspace-profile',
      data,
      overrideAccess: true,
      context: governanceAuditContext(
        user,
        'workspace_profile_updated',
        targetDomain ? `Workspace set to ${targetDomain}` : 'Workspace profile saved',
      ),
    })
    revalidatePath(HUB_PATH)
    revalidatePath('/admin')
    revalidatePath('/admin/ops/setup/workspace')
    const profile = resolveWorkspaceProfile(doc, process.env, {
      mockDefault: modeFromEnv(process.env) === 'mock',
    })
    return { ok: true, problems: workspaceProfileProblems(profile) }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not save the workspace.') }
  }
}

// ---------------------------------------------------------------------------
// Audiences (ICPs)
// ---------------------------------------------------------------------------

/**
 * `IcpContent` as the collection stores it: text lists become rows, and every
 * empty date becomes null.
 *
 * `status` and `primary` are absent on purpose. They are the two fields the
 * activation gate judges, and an ordinary save that carried them would either
 * re-run the gate on an untouched status or let a form make itself primary
 * behind the cascade's back.
 */
const icpFields = (icp: IcpContent) => ({
  name: icp.name,
  who: icp.who,
  pains: icp.pains.map((pain) => ({
    statement: pain.statement,
    evidence: pain.evidence.map((row) => ({ ref: row.ref, note: row.note })),
    confidence: pain.confidence,
  })),
  motivation: { ...icp.motivation },
  solution: {
    mechanism: icp.solution.mechanism,
    sampleLines: icp.solution.sampleLines.map((text) => ({ text })),
    confidence: icp.solution.confidence,
  },
  competition: icp.competition.map((row) => ({
    competitor: row.competitor,
    claim: row.claim,
    claimedAt: dateOrNull(row.claimedAt),
    source: row.source,
    confidence: row.confidence,
  })),
  whyUs: { ...icp.whyUs },
  channels: icp.channels.map((row) => ({ ...row })),
  churnTriggers: icp.churnTriggers.map((text) => ({ text })),
  notOurUser: icp.notOurUser.map((text) => ({ text })),
})

function revalidateIcps(id?: number | string) {
  revalidatePath(HUB_PATH)
  revalidatePath('/admin')
  revalidatePath('/admin/ops/setup/audiences')
  if (id != null) revalidatePath(`/admin/ops/setup/audiences/${id}`)
}

export async function createIcpAction(
  input: IcpContent,
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  try {
    const { payload, user } = await requireUser()
    const content = icpContentOf(input)
    const doc = await payload.create({
      collection: 'icps',
      data: { ...icpFields(content), name: content.name || 'Untitled audience', status: 'draft' },
      context: governanceAuditContext(user, 'icp_created', 'Audience drafted'),
      user,
      overrideAccess: false,
    })
    revalidateIcps(doc.id)
    return { ok: true, id: doc.id }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not create the audience.') }
  }
}

export async function saveIcpAction(id: number, input: IcpContent): Promise<SaveResult> {
  try {
    const { payload, user } = await requireUser()
    const content = icpContentOf(input)
    await payload.update({
      collection: 'icps',
      id,
      data: { ...icpFields(content), name: content.name || 'Untitled audience' },
      context: governanceAuditContext(user, 'icp_updated', `Audience "${content.name}" saved`),
      user,
      overrideAccess: false,
    })
    revalidateIcps(id)
    return { ok: true, problems: icpCompletenessProblems(content) }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not save the audience.') }
  }
}

export async function activateIcpAction(id: number): Promise<TenantActionResult> {
  try {
    const { payload, user } = await requireUser()
    await payload.update({
      collection: 'icps',
      id,
      data: { status: 'active' },
      context: governanceAuditContext(user, 'icp_activated', 'Audience activated'),
      user,
      overrideAccess: false,
    })
    revalidateIcps(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not activate the audience.') }
  }
}

export async function setPrimaryIcpAction(id: number): Promise<TenantActionResult> {
  try {
    const { payload, user } = await requireUser()
    await payload.update({
      collection: 'icps',
      id,
      data: { primary: true },
      context: governanceAuditContext(user, 'icp_primary_set', 'Audience made primary'),
      user,
      overrideAccess: false,
    })
    revalidateIcps(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not make this the primary audience.') }
  }
}

export async function archiveIcpAction(id: number): Promise<TenantActionResult> {
  try {
    const { payload, user } = await requireUser()
    await payload.update({
      collection: 'icps',
      id,
      // Cleared with the same write: an archived record must never stay the
      // pointer every new piece is created against.
      data: { status: 'archived', primary: false },
      context: governanceAuditContext(user, 'icp_archived', 'Audience archived'),
      user,
      overrideAccess: false,
    })
    revalidateIcps(id)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not archive the audience.') }
  }
}

export async function deleteIcpDraftAction(id: number): Promise<TenantActionResult> {
  try {
    const { payload, user } = await requireUser()
    await payload.delete({ collection: 'icps', id, user, overrideAccess: false })
    revalidateIcps()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not delete the draft.') }
  }
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

export async function savePositioningAction(input: PositioningContent): Promise<SaveResult> {
  try {
    const { payload, user } = await requireUser()
    const content = positioningContentOf(input)
    await payload.updateGlobal({
      slug: 'positioning',
      data: {
        ...content,
        openRulings: content.openRulings.map((row) => ({
          ...row,
          ruledAt: dateOrNull(row.ruledAt),
        })),
      },
      overrideAccess: true,
      context: governanceAuditContext(
        user,
        'positioning_updated',
        content.activePosition
          ? `Positioning saved: "${content.activePosition}"`
          : 'Positioning saved',
      ),
    })
    revalidatePath(HUB_PATH)
    revalidatePath('/admin')
    revalidatePath('/admin/ops/setup/positioning')
    return { ok: true, problems: positioningCompletenessProblems(content) }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not save the positioning.') }
  }
}

// ---------------------------------------------------------------------------
// Evidence bank
// ---------------------------------------------------------------------------

/**
 * Save the bank, letting the global's hook mint refs for anything new.
 *
 * Rows are not run through `parseEvidenceBankContent` on the way in: that
 * parser drops any row without a ref, which is every row the operator just
 * typed. So the shaping is done here — trim, dates to null, an existing ref
 * preserved exactly, a missing one left off entirely for the hook.
 */
export async function saveEvidenceBankAction(
  input: EvidenceBankInput,
): Promise<{ ok: true; saved: EvidenceBankContent } | { ok: false; error: string }> {
  try {
    const { payload, user } = await requireUser()
    const ref = (value: string | undefined) =>
      typeof value === 'string' && value.trim() ? { ref: value.trim() } : {}
    const data = {
      verifiedClaims: input.verifiedClaims
        .filter((row) => (row.claim ?? '').trim())
        .map((row) => ({
          ...ref(row.ref),
          claim: row.claim.trim(),
          primarySource: row.primarySource ?? '',
          sourceUrl: row.sourceUrl ?? '',
          sourceDate: dateOrNull(row.sourceDate),
          sampleOrMethod: row.sampleOrMethod ?? '',
          verificationDepth: row.verificationDepth || null,
          limits: row.limits ?? '',
          clearedSurfaces: row.clearedSurfaces ?? [],
          recheckAt: dateOrNull(row.recheckAt),
        })),
      facts: input.facts
        .filter((row) => (row.fact ?? '').trim())
        .map((row) => ({
          ...ref(row.ref),
          fact: row.fact.trim(),
          source: row.source ?? '',
          owner: row.owner ?? '',
          lastConfirmedAt: dateOrNull(row.lastConfirmedAt),
        })),
      rejectedClaims: input.rejectedClaims
        .filter((row) => (row.claim ?? '').trim())
        .map((row) => ({
          ...ref(row.ref),
          claim: row.claim.trim(),
          status: row.status === 'expired' ? ('expired' as const) : ('rejected' as const),
          reason: row.reason ?? '',
          replacement: row.replacement ?? '',
        })),
    }
    const doc = await payload.updateGlobal({
      slug: 'evidence-bank',
      data,
      overrideAccess: true,
      context: governanceAuditContext(
        user,
        'evidence_bank_updated',
        `Evidence bank saved: ${data.verifiedClaims.length} claim(s), ${data.facts.length} fact(s), ${data.rejectedClaims.length} rejected`,
      ),
    })
    revalidatePath(HUB_PATH)
    revalidatePath('/admin')
    revalidatePath('/admin/ops/setup/evidence')
    // The saved document, not the input: the hook has just minted refs for the
    // new rows, and the editor needs them to show what a draft would cite.
    return { ok: true, saved: evidenceBankContentOf(doc) }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not save the evidence bank.') }
  }
}

// ---------------------------------------------------------------------------
// The demo workspace, and the two things the runtime banner and hub need
// ---------------------------------------------------------------------------

/**
 * Fill the workspace profile from the fixture, but only where the operator
 * has left a field blank. Somebody who has already typed their own domain and
 * then clicks "start with the demo workspace" for the audiences must not have
 * it overwritten.
 */
async function upsertWorkspaceProfile(payload: Payload): Promise<void> {
  const current = (await payload.findGlobal({
    slug: 'workspace-profile',
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>
  const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''
  const data: Record<string, unknown> = {}
  if (blank(current.companyName)) data.companyName = WORKSPACE_PROFILE_FIXTURE.companyName
  if (blank(current.targetDomain)) data.targetDomain = WORKSPACE_PROFILE_FIXTURE.targetDomain
  if (blank(current.siteNotes)) data.siteNotes = WORKSPACE_PROFILE_FIXTURE.siteNotes
  if (!Array.isArray(current.competitors) || current.competitors.length === 0) {
    data.competitors = WORKSPACE_PROFILE_FIXTURE.competitors
  }
  if (Object.keys(data).length === 0) return
  await payload.updateGlobal({ slug: 'workspace-profile', data, overrideAccess: true })
}

/** The fixture as the `icps` collection stores it: arrays of rows, not bare strings. */
const icpDocData = (icp: IcpContent, primary: boolean) => ({
  ...icpFields(icp),
  status: 'active' as const,
  primary,
})

async function upsertIcp(payload: Payload, icp: IcpContent, primary: boolean): Promise<void> {
  const data = icpDocData(icp, primary)
  const existing = await payload.find({
    collection: 'icps',
    where: { name: { equals: icp.name } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    await payload.update({ collection: 'icps', id: existing.docs[0].id, data, overrideAccess: true })
  } else {
    await payload.create({ collection: 'icps', data, overrideAccess: true })
  }
}

/**
 * Fill the positioning global, but only when nothing has been saved at all.
 *
 * Unlike the workspace profile this is not merged field by field: a position is
 * one argument, and half the demo brand's position mixed into half of yours is
 * a position nobody holds. An operator who has started writing their own keeps
 * every word of it.
 */
async function upsertPositioning(payload: Payload): Promise<void> {
  const current = await payload.findGlobal({
    slug: 'positioning',
    depth: 0,
    overrideAccess: true,
  })
  if (positioningStatus(positioningContentOf(current)) !== 'missing') return
  await payload.updateGlobal({
    slug: 'positioning',
    data: positioningFixtureDoc(),
    overrideAccess: true,
  })
}

/**
 * Fill the evidence bank, but only when it is completely empty.
 *
 * Merging is worse than useless here. Demo claims about a company that is not
 * yours are exactly the rows the writer is told it may state as fact, and an
 * operator who has entered one real claim must not find two invented ones
 * filed beside it.
 */
async function upsertEvidenceBank(payload: Payload): Promise<void> {
  const current = await payload.findGlobal({
    slug: 'evidence-bank',
    depth: 0,
    overrideAccess: true,
  })
  if (!isEvidenceBankEmpty(evidenceBankContentOf(current))) return
  await payload.updateGlobal({
    slug: 'evidence-bank',
    data: evidenceBankFixtureDoc(),
    overrideAccess: true,
  })
}

/**
 * Activate the demo brand voice so a new workspace can make its first piece
 * without writing a voice guide first. Same upsert the `--with-brand-voice`
 * seed runs; the single-active cascade on the collection keeps it the only
 * active one. The editor can replace it from the Brand voice page any time.
 */
export async function activateDefaultBrandVoiceAction(): Promise<TenantActionResult> {
  try {
    const { payload } = await requireUser()
    // Same shape the seed writes; `source`/`onboardingStep` are what the
    // collection type requires beyond the voice content itself.
    const data = {
      ...BRAND_VOICE_FIXTURE,
      status: 'active' as const,
      source: 'onboarding' as const,
      onboardingStep: 9,
    }
    const existing = await payload.find({
      collection: 'brand-voices',
      where: { name: { equals: data.name } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs[0]) {
      await payload.update({ collection: 'brand-voices', id: existing.docs[0].id, data })
    } else {
      await payload.create({ collection: 'brand-voices', data })
    }
    revalidatePath('/admin')
    revalidatePath(HUB_PATH)
    revalidatePath('/admin/ops/governance/brand-voice')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not activate the default voice.') }
  }
}

/** What the runtime banner needs: live mode with anything missing. */
export async function runtimeStatusAction(): Promise<{
  mode: 'mock' | 'live'
  missing: string[]
  needsCodexLogin: boolean
}> {
  try {
    const { payload } = await requireUser()
    const { readiness } = await loadWorkspaceSetup(payload)
    return {
      mode: readiness.mode,
      missing: readiness.runtime.missing,
      needsCodexLogin: readiness.runtime.needsCodexLogin,
    }
  } catch {
    return { mode: 'mock', missing: [], needsCodexLogin: false }
  }
}

/**
 * One click from "nothing set up" to "can make a piece".
 *
 * Slice 2 gates content runs on a target domain and an active audience, which
 * would strand every existing workspace behind two forms it has never seen.
 * This writes the demo workspace instead: the profile where it is still blank,
 * both audience fixtures, the position when there is none, and the default
 * brand voice. Everything it writes is
 * an ordinary record the operator can edit or archive.
 */
export async function activateDefaultTenantAction(): Promise<TenantActionResult> {
  try {
    const { payload } = await requireUser()
    await upsertWorkspaceProfile(payload)
    // Primary first: the single-primary cascade clears the others, so the
    // secondary must not be able to claim the flag on the way past.
    await upsertIcp(payload, ICP_FIXTURE, true)
    await upsertIcp(payload, ICP_FIXTURE_SECONDARY, false)
    await upsertPositioning(payload)
    await upsertEvidenceBank(payload)
    // Reused rather than copied: the single-active cascade means two upserts
    // that disagreed about the fixture would keep archiving each other.
    const voice = await activateDefaultBrandVoiceAction()
    if (!voice.ok) return voice
    revalidatePath('/admin')
    revalidatePath(HUB_PATH)
    revalidatePath('/admin/ops/setup/workspace')
    revalidatePath('/admin/ops/setup/audiences')
    revalidatePath('/admin/ops/setup/positioning')
    revalidatePath('/admin/ops/setup/evidence')
    revalidatePath('/admin/ops/governance/brand-voice')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not set up the demo workspace.') }
  }
}
