'use server'

import { randomUUID } from 'node:crypto'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload, type Payload } from 'payload'

import { createAhrefsClient, type DiscoveredKeyword } from '../../../../pipeline/src/ahrefs'
import { config as pipelineConfig } from '../../../../pipeline/src/config'
import { resolveWorkspaceProfile } from '../../../../pipeline/src/tenant'
import { ActivePipelineRunError, createPipelineRun } from '../../lib/createPipelineRun'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import type {
  CreateTopicsResult,
  DiscoverResult,
  RecentSearch,
} from './topicDiscoveryTypes'

const BOARD_PATH = '/admin/ops/content'

/**
 * How long a cached lookup is served before it is refetched.
 *
 * Search volume and difficulty move slowly — a week-old answer is the same
 * answer — and every miss costs Ahrefs API units, so the default is generous.
 * The operator can always force fresh numbers from the panel.
 */
const TOPIC_SEARCH_TTL_DAYS = 7

/** `  NFL  Games ` and `nfl games` are one question and must share one row. */
const seedKeyOf = (seed: string): string => seed.trim().toLowerCase().replace(/\s+/g, ' ')

const isFresh = (fetchedAt: string | null | undefined): boolean => {
  if (!fetchedAt) return false
  const at = new Date(fetchedAt).getTime()
  if (Number.isNaN(at)) return false
  return Date.now() - at < TOPIC_SEARCH_TTL_DAYS * 86_400_000
}

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in to discover topics.')
  return { payload, user }
}

/**
 * The workspace the Ahrefs client works for. Matching-terms lookups do not need
 * a domain, but the client is built the same way everywhere so a country or
 * competitor change lands in one place rather than three.
 */
async function workspaceProfile(payload: Payload, mode: 'mock' | 'live') {
  const doc = await payload.findGlobal({
    slug: 'workspace-profile',
    depth: 0,
    overrideAccess: true,
  })
  return resolveWorkspaceProfile(doc, process.env, { mockDefault: mode === 'mock' })
}

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return fallback
}

/**
 * Suggest topics around a phrase the operator typed.
 *
 * Read-only on purpose: nothing is written until they pick from the list. That
 * keeps an exploratory search free of half-created articles, and lets them try
 * several seeds before committing to any.
 */
export async function discoverTopicsAction(
  seed: string,
  options: { refresh?: boolean } = {},
): Promise<DiscoverResult> {
  try {
    const term = seed.trim()
    if (!term) return { ok: false, error: 'Type a topic to search for.' }
    const { payload } = await requireUser()
    const seedKey = seedKeyOf(term)
    const country = process.env.AHREFS_COUNTRY || 'us'

    const { docs: cachedDocs } = await payload.find({
      collection: 'topic-searches',
      where: { and: [{ seedKey: { equals: seedKey } }, { country: { equals: country } }] },
      sort: '-fetchedAt',
      limit: 1,
      depth: 0,
    })
    const cachedRow = cachedDocs[0]
    const usableCache =
      !options.refresh && cachedRow && isFresh(cachedRow.fetchedAt) && Array.isArray(cachedRow.candidates)
        ? (cachedRow.candidates as DiscoveredKeyword[])
        : null

    // Discovery has no pipeline-runs row to carry a mode, so the ambient config
    // decides — the same signal the run bar shows the operator.
    const mode = pipelineConfig.mockMode ? 'mock' : 'live'
    const candidates =
      usableCache ??
      (await createAhrefsClient(mode, await workspaceProfile(payload, mode)).discoverKeywords(
        term,
        25,
      ))
    if (candidates.length === 0) {
      return { ok: false, error: `No keywords came back for "${term}". Try a broader phrase.` }
    }

    const fetchedAt = usableCache ? String(cachedRow!.fetchedAt) : new Date().toISOString()
    if (!usableCache) {
      // Replace rather than accumulate: one row per (seed, country) keeps the
      // recent-searches list meaningful and the lookup a single hit.
      if (cachedRow) {
        await payload.delete({ collection: 'topic-searches', id: cachedRow.id, overrideAccess: true })
      }
      await payload.create({
        collection: 'topic-searches',
        overrideAccess: true,
        data: { seed: term, seedKey, country, fetchedAt, resultCount: candidates.length, candidates },
      })
    }

    // Taken-ness is read live even for a cached lookup: articles are created
    // between searches, and a stale "available" row would let someone pick a
    // keyword that already has an article.
    const { docs } = await payload.find({
      collection: 'articles',
      where: { keyword: { in: candidates.map((c) => c.keyword) } },
      pagination: false,
      depth: 0,
      limit: 500,
    })
    const taken = new Set(docs.map((d) => d.keyword?.toLowerCase()).filter(Boolean))
    // An archived article still owns its keyword, so the row stays unpickable —
    // but "removed from the board" and "already being written" are different
    // answers to "why can't I pick this", and the panel says which.
    const archived = new Set(
      docs.filter((d) => d.archived).map((d) => d.keyword?.toLowerCase()).filter(Boolean),
    )

    return {
      ok: true,
      seed: term,
      cached: usableCache !== null,
      fetchedAt,
      candidates: candidates.map((c) => ({
        ...c,
        alreadyTaken: taken.has(c.keyword.toLowerCase()),
        archived: archived.has(c.keyword.toLowerCase()),
      })),
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not search for topics.') }
  }
}

/** The last few subjects searched, so work survives leaving the screen. */
export async function recentSearchesAction(limit = 6): Promise<RecentSearch[]> {
  try {
    const { payload } = await requireUser()
    const { docs } = await payload.find({
      collection: 'topic-searches',
      sort: '-fetchedAt',
      limit,
      depth: 0,
    })
    return docs.map((d) => ({
      seed: d.seed,
      fetchedAt: String(d.fetchedAt),
      resultCount: d.resultCount ?? 0,
    }))
  } catch {
    return []
  }
}

/**
 * Create ONE article covering every keyword the operator ticked.
 *
 * Deliberately not one article per keyword. Someone who picks four searches
 * around a subject wants a single piece that covers the group — splitting them
 * produces four thin articles competing with each other for the same intent,
 * which is the opposite of what they asked for. The highest-opportunity pick
 * becomes the primary keyword (it is what the SERP research and the corpus
 * snapshot key on) and the rest ride along as secondaries, which reach both the
 * generate prompt and the scored query cluster.
 */
export async function createTopicsAction(input: {
  keywords: string[]
  templateId: number
}): Promise<CreateTopicsResult> {
  try {
    const { payload, user } = await requireUser()
    const wanted = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))]
    if (wanted.length === 0) return { ok: false, error: 'Pick at least one topic.' }
    if (!Number.isFinite(input.templateId) || input.templateId <= 0) {
      return { ok: false, error: 'Choose a content template.' }
    }

    const { docs: existing } = await payload.find({
      collection: 'articles',
      where: { keyword: { in: wanted } },
      pagination: false,
      depth: 0,
      limit: 500,
    })
    const taken = new Set(existing.map((d) => d.keyword?.toLowerCase()).filter(Boolean))
    const free = wanted.filter((k) => !taken.has(k.toLowerCase()))
    if (free.length === 0) {
      return { ok: false, error: 'Every topic you picked already has an article.' }
    }

    // `wanted` arrives in the order the panel listed it, which is already sorted
    // by opportunity, so the first surviving pick is the strongest one.
    const [primary, ...secondaries] = free
    // Loaded before the create so the piece starts pointed at an audience; the
    // same call answers whether research can start at all, a few lines down.
    const setup = await loadWorkspaceSetup(payload)
    const primaryIcpId = setup.icps.find((icp) => icp.primary)?.id ?? null
    const created = await payload.create({
      collection: 'articles',
      data: {
        keyword: primary,
        title: primary,
        status: 'topic_selected',
        template: input.templateId,
        secondaryKeywords: secondaries.map((keyword) => ({ keyword })),
        ...(primaryIcpId != null ? { icp: primaryIcpId } : {}),
      },
      user,
      overrideAccess: false,
      context: {
        articleAudit: {
          actor: typeof user.email === 'string' ? user.email : String(user.id),
          actorType: 'user' as const,
          event: 'topic_selected_by_user',
          summary:
            secondaries.length > 0
              ? `Topic chosen from discovery, covering ${secondaries.length + 1} related searches`
              : 'Topic chosen from discovery',
          details: { keyword: primary, secondaryKeywords: secondaries, source: 'topic-discovery' },
        },
      },
    })

    // Research starts on its own. There is no "run" button to find afterwards:
    // the next thing the editor sees is the brief. If the workspace is not
    // ready (no brand voice, missing keys) the piece still exists and the
    // list says what it is waiting on.
    let researchQueued = false
    const { readiness } = setup
    if (readiness.runtime.ready && readiness.governance.ready) {
      try {
        await createPipelineRun(payload, user, {
          runId: randomUUID(),
          source: 'selected',
          templateId: input.templateId,
          count: 1,
          articleIds: [created.id],
          requestedBy: typeof user.email === 'string' ? user.email : String(user.id),
          readiness,
        })
        researchQueued = true
      } catch (e) {
        // `selected` runs queue behind an active one, so this is only reached
        // on a real failure; the piece is still there for a later run.
        if (!(e instanceof ActivePipelineRunError)) throw e
      }
    }

    revalidatePath(BOARD_PATH)
    revalidatePath('/admin/ops/new')
    return {
      ok: true,
      articleId: created.id,
      primary,
      covered: free.length,
      skipped: wanted.length - free.length,
      researchQueued,
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not create that topic.') }
  }
}
