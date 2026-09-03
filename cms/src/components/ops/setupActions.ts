'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { randomUUID } from 'node:crypto'

import { mapWithConcurrency } from '../../../../pipeline/src/corpus/concurrency'
import { fetchPage } from '../../../../pipeline/src/corpus/fetchPage'
import { brandVoiceContentOf } from '../../lib/brandVoice'
import { CmsLlmError, cmsMockMode, completeJsonCms, logCmsCost } from '../../lib/cmsLlm'
import { type LlmSettingsDoc, resolveSetupAssistModel } from '../../lib/llmSettings'
import { icpsFromDocs } from '../../lib/tenant'
import {
  type AssistAsset,
  type AssistContext,
  assistSourceTexts,
  buildAssistPrompt,
  isAssistAsset,
  isAssistSection,
  parseAssistReply,
} from '../../lib/tenant/assist'
import { assistMock } from '../../lib/tenant/assistFixtures'
import {
  evidenceBankContentOf,
  isEvidenceBankEmpty,
} from '../../lib/tenant/evidenceBank'
import { positioningContentOf, positioningStatus } from '../../lib/tenant/positioning'
import {
  candidatePagePaths,
  isSameSite,
  MAX_SITE_PAGES,
  toSitePage,
} from '../../lib/tenant/sitePages'
import {
  resolveWorkspaceProfile,
  userAgentFor,
  type SitePage,
  type WorkspaceProfileDoc,
} from '../../lib/tenant/workspaceProfile'
import { modeFromEnv } from '../../lib/workspaceReadiness'

const VIEW_PATH = '/admin/ops/setup'

/**
 * How many of the site's pages are fetched at once.
 *
 * Three is the same neighbourliness the corpus crawl practises, and this crawl
 * has less excuse than that one: it is pointed at the operator's own site, from
 * a button they just pressed, so there is nobody to impress with speed.
 */
const SITE_PAGE_CONCURRENCY = 3

/**
 * The whole refresh's budget, against a 15 s per-request timeout.
 *
 * A person is watching a spinner, so the answer has to arrive. Eight pages that
 * each time out would take two minutes; at forty seconds we stop asking and
 * report what we have, with a warning naming what we skipped. Partial pages are
 * still useful — the assistant reads whatever it was given.
 */
const REFRESH_BUDGET_MS = 40_000

export type RefreshSitePagesResult =
  | { ok: true; pages: number; warnings: string[] }
  | { ok: false; error: string }

async function requireUser(purpose = 'change the workspace setup') {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error(`Sign in to ${purpose}.`)
  return { payload, user }
}

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

/** What went wrong with one page, in the operator's words. */
function pageWarning(url: string, reason: string | null): string {
  return `${url}: ${reason ?? 'could not be read'}`
}

/**
 * Reads the workspace's own site so the setup assistant has something to work
 * from: the home page, plus up to seven marketing pages linked from it.
 *
 * Everything below the home page is best-effort. A page that 404s, redirects
 * off-site, serves a PDF, or resolves to a private address is a warning and not
 * a failure — a site with a broken `/customers` link should still get an ICP
 * drafted from the four pages that did load. Three things end the run: no
 * target domain to fetch, a home page that could not be read at all, and a home
 * page that turns out to belong to somebody else. The first two leave nothing
 * to discover from; the third would quietly describe the wrong company.
 *
 * The crawl reuses `fetchPage`, so the SSRF guard, the redirect handling, the
 * byte ceiling, and the mock mode all come for free.
 */
export async function refreshSitePagesAction(): Promise<RefreshSitePagesResult> {
  const { payload, user } = await requireUser('fetch the site pages')
  const mode = modeFromEnv(process.env)
  const doc = (await payload.findGlobal({
    slug: 'workspace-profile',
    depth: 0,
    overrideAccess: true,
  })) as WorkspaceProfileDoc
  const profile = resolveWorkspaceProfile(doc, process.env, { mockDefault: mode === 'mock' })

  const domain = profile.targetDomain
  if (!domain) {
    return {
      ok: false,
      error: 'Set the target domain on the workspace before fetching its pages.',
    }
  }

  const mock = mode === 'mock'
  const userAgent = userAgentFor(domain)
  const homeUrl = `https://${domain}/`
  const deadline = Date.now() + REFRESH_BUDGET_MS
  const warnings: string[] = []

  // Readability throws the anchors away, so the links have to be taken from the
  // markup on the way past. Mock mode never calls this, and falls back to the
  // canned text, which names its own links.
  let homeHtml = ''
  const home = await fetchPage(homeUrl, {
    mock,
    userAgent,
    onHtml: (html) => {
      homeHtml = html
    },
  })
  if (home.status !== 'ok') {
    return { ok: false, error: `Could not read ${homeUrl} — ${home.reason ?? 'fetch failed'}.` }
  }

  // A home page that redirects off the workspace's own domain ends the run
  // without storing anything. A parked domain, a stale DNS record, or a domain
  // sold since somebody typed it into the workspace all answer politely with
  // somebody else's marketing, and these pages are the material the assistant
  // drafts an audience, a position, and an evidence bank from. Half a stranger's
  // site is worse than no site: nothing downstream would say where it came from.
  const homeFinalUrl = home.finalUrl || homeUrl
  if (!isSameSite(homeFinalUrl, domain)) {
    return {
      ok: false,
      error:
        `${homeUrl} redirects to ${homeFinalUrl}, which is not on ${domain}. ` +
        'Nothing was stored. Set the target domain to the site you want read.',
    }
  }

  const pages: SitePage[] = [toSitePage(home)]
  // Safe to discover against the redirected address: the check above is what
  // proves it is still this site, so `https://acme.com` → `https://www.acme.com`
  // resolves its relative links against the host that served them.
  const candidates = candidatePagePaths(homeHtml || home.text, homeFinalUrl)

  let skipped = 0
  const fetched = await mapWithConcurrency(candidates, SITE_PAGE_CONCURRENCY, async (url) => {
    if (Date.now() >= deadline) {
      skipped += 1
      return null
    }
    return fetchPage(url, { mock, userAgent })
  })

  for (const [index, page] of fetched.entries()) {
    if (!page) continue
    const requested = candidates[index] ?? page.url
    if (page.status === 'ok') {
      const finalUrl = page.finalUrl || page.url
      // A sub-page that leaves the site is dropped rather than fatal: one
      // marketing path pointing at a partner or a status page is ordinary, and
      // the pages that did load are still worth having.
      if (!isSameSite(finalUrl, domain)) {
        warnings.push(pageWarning(requested, `redirects to ${finalUrl}, which is not on ${domain}`))
        continue
      }
      pages.push(toSitePage(page))
      continue
    }
    warnings.push(pageWarning(requested, page.reason))
  }
  if (skipped > 0) {
    warnings.push(
      `Stopped after ${Math.round(REFRESH_BUDGET_MS / 1000)}s; ${skipped} more page(s) were not fetched.`,
    )
  }

  // Discovery already caps itself, but the stored set is what the prompt pays
  // for, so the ceiling is enforced where the write happens too.
  const stored = pages.slice(0, MAX_SITE_PAGES)

  await payload.updateGlobal({
    slug: 'workspace-profile',
    data: { sitePages: stored, sitePagesFetchedAt: new Date().toISOString() },
    overrideAccess: true,
    context: governanceAuditContext(
      user,
      'site_pages_refreshed',
      `Fetched ${stored.length} page${stored.length === 1 ? '' : 's'} from ${domain}`,
      { domain, urls: stored.map((page) => page.url), warnings },
    ),
  })
  revalidatePath(VIEW_PATH)

  return { ok: true, pages: stored.length, warnings }
}

// ---------------------------------------------------------------------------
// "Draft with AI" / "Refine"
// ---------------------------------------------------------------------------

export type { AssistAsset }

export type AssistMode = 'draft' | 'refine'

export interface AssistInput {
  asset: AssistAsset
  /** One of `ASSIST_SECTIONS[asset]`. */
  section: string
  mode: AssistMode
  /** The operator's notes for this step. May be ''. */
  notes: string
  /** The section's current value; used by `refine`, ignored by `draft`. */
  current: unknown
  /** `asset === 'icp'`: the record being edited. Omit for a new audience. */
  icpId?: number
}

export type AssistResult =
  | { ok: true; value: unknown; warnings: string[]; model: string; mock: boolean }
  | { ok: false; error: string }

/** The stage every assist call bills against, mock rows included. */
const ASSIST_STAGE = 'setupAssist'

function assistError(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return fallback
}

/**
 * Everything the assistant may read, resolved in one pass.
 *
 * The same loads `loadTenantContext` does, minus the logging: one query per
 * asset, the active brand voice by the same rule the pipeline uses, and the
 * audiences primary-first. The audience being edited is dropped from the
 * context — it is the thing being written, and handing the model its current
 * text as "what we already know" is how a refine turns into a paraphrase.
 */
async function loadAssistContext(
  payload: Awaited<ReturnType<typeof requireUser>>['payload'],
  icpId: number | undefined,
): Promise<{ ctx: AssistContext; settings: LlmSettingsDoc }> {
  const mode = modeFromEnv(process.env)
  const [profileDoc, voiceResult, icpResult, positioningDoc, evidenceDoc, settings] =
    await Promise.all([
      payload.findGlobal({ slug: 'workspace-profile', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'brand-voices',
        where: { status: { equals: 'active' } },
        limit: 1,
        depth: 0,
        sort: '-activatedAt',
        overrideAccess: true,
      }),
      payload.find({
        collection: 'icps',
        where: { status: { equals: 'active' } },
        sort: ['-primary', 'name'],
        pagination: false,
        depth: 0,
        overrideAccess: true,
      }),
      payload.findGlobal({ slug: 'positioning', depth: 0, overrideAccess: true }),
      payload.findGlobal({ slug: 'evidence-bank', depth: 0, overrideAccess: true }),
      payload.findGlobal({ slug: 'llm-settings', depth: 0, overrideAccess: true }),
    ])

  const positioning = positioningContentOf(positioningDoc)
  const evidenceBank = evidenceBankContentOf(evidenceDoc)
  const voiceDoc = voiceResult.docs[0]
  return {
    settings: settings as LlmSettingsDoc,
    ctx: {
      profile: resolveWorkspaceProfile(profileDoc as WorkspaceProfileDoc, process.env, {
        mockDefault: mode === 'mock',
      }),
      brandVoice: voiceDoc ? brandVoiceContentOf(voiceDoc) : null,
      icps: icpsFromDocs(icpResult.docs).filter(
        (icp) => icpId === undefined || String(icp.id) !== String(icpId),
      ),
      positioning: positioningStatus(positioning) === 'missing' ? null : positioning,
      evidenceBank: isEvidenceBankEmpty(evidenceBank) ? null : evidenceBank,
      asOf: new Date().toISOString().slice(0, 10),
    },
  }
}

/**
 * One model call that drafts or revises a single section of one tenant asset.
 *
 * Saves nothing, by design: the editor merges the returned value into its form
 * state and the operator decides what survives, so the governance audit still
 * records a person's save rather than a model's suggestion. Every call leaves a
 * cost row behind — including a mock one at zero, so a workspace can see how
 * often the button is pressed before it is ever billed for it.
 */
export async function assistAction(input: AssistInput): Promise<AssistResult> {
  let payload
  try {
    ;({ payload } = await requireUser('use the setup assistant'))
  } catch (e) {
    return { ok: false, error: assistError(e, 'Sign in to use the setup assistant.') }
  }

  if (!isAssistAsset(input.asset)) {
    return { ok: false, error: `"${String(input.asset)}" is not something the assistant can draft.` }
  }
  if (!isAssistSection(input.asset, input.section)) {
    return {
      ok: false,
      error: `"${String(input.section)}" is not a section of the ${input.asset} record.`,
    }
  }
  if (input.mode !== 'draft' && input.mode !== 'refine') {
    return { ok: false, error: `"${String(input.mode)}" is not a mode; use draft or refine.` }
  }

  const notes = typeof input.notes === 'string' ? input.notes : ''
  const request = { asset: input.asset, section: input.section, mode: input.mode }
  const { ctx, settings } = await loadAssistContext(payload, input.icpId)
  const model = resolveSetupAssistModel(settings, process.env).model
  const runId = `setup-assist:${randomUUID()}`

  if (cmsMockMode(process.env, model)) {
    const { value, warnings } = assistMock({ ...input, notes })
    await logCmsCost(payload, {
      runId,
      stage: ASSIST_STAGE,
      provider: 'mock',
      model,
      usage: { inputTokens: 0, outputTokens: 0 },
      request: { ...request, notesChars: notes.length, pagesChars: 0 },
      response: { warnings, keys: Object.keys(value) },
    })
    return { ok: true, value, warnings, model, mock: true }
  }

  const { system, user } = buildAssistPrompt({ ...input, notes }, ctx)
  const pagesChars = ctx.profile.sitePages.reduce((total, page) => total + page.text.length, 0)
  const billing = { ...request, notesChars: notes.length, pagesChars }

  let result
  try {
    result = await completeJsonCms({ system, user, model, label: 'Setup assistant' })
  } catch (e) {
    if (e instanceof CmsLlmError) {
      // The call was billed even though the reply was unusable — record it.
      await logCmsCost(payload, {
        runId,
        stage: ASSIST_STAGE,
        ...e.billed,
        request: billing,
        response: { error: 'reply unusable; see server log' },
      })
      return { ok: false, error: e.message }
    }
    return { ok: false, error: assistError(e, 'The setup assistant could not be reached.') }
  }

  const { value, warnings } = parseAssistReply(input.asset, input.section, result.json, {
    sourceTexts: assistSourceTexts(notes, ctx),
  })
  await logCmsCost(payload, {
    runId,
    stage: ASSIST_STAGE,
    provider: result.provider,
    model: result.model,
    usage: result.usage,
    request: billing,
    response: { warnings, keys: Object.keys(value) },
  })
  return { ok: true, value, warnings, model: result.model, mock: false }
}
