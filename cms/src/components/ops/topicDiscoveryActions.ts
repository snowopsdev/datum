'use server'

import { revalidatePath } from 'next/cache'
import { errorMessage } from '../../lib/errorMessage'
import { requireUser } from '../../lib/requireUser'
import { loadTenantContextCms } from '../../lib/loadTenantContextCms'
import { resolveTopicRelevanceModel } from '../../lib/llmSettings'
import { scoreTopicRelevance } from '../../lib/scoreTopicRelevance'
import { parseTopicRelevance, rankByFit, relevanceFingerprint } from '../../lib/tenant/topicRelevance'

import { createAhrefsClient, type DiscoveredKeyword } from '../../../../pipeline/src/ahrefs'
import { config as pipelineConfig } from '../../../../pipeline/src/config'
import { ActivePipelineRunError } from '../../lib/createPipelineRun'
import { loadWorkspaceSetup } from '../../lib/loadWorkspaceReadiness'
import { gateRunReadiness, queueRunForArticles } from '../../lib/queueRunForArticles'
import type { CreateTopicsResult, DiscoverResult, RecentSearch } from './topicDiscoveryTypes'

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

/** Cached JSON is untrusted; discard a malformed cache rather than casting it. */
function cachedCandidates(raw: unknown): DiscoveredKeyword[] | null {
  if (!Array.isArray(raw)) return null
  const rows = raw.flatMap((r): DiscoveredKeyword[] => {
    if (!r || typeof r !== 'object' || typeof r.keyword !== 'string' || !r.keyword.trim() || ![r.volume,r.difficulty,r.opportunity].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) return []
    return [{keyword:r.keyword.trim(),volume:r.volume,difficulty:r.difficulty,opportunity:r.opportunity}]
  })
  return rows.length === raw.length ? rows : null
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
    const { payload } = await requireUser('Sign in to discover topics.')
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
      !options.refresh &&
      cachedRow &&
      isFresh(cachedRow.fetchedAt) &&
      Array.isArray(cachedRow.candidates)
        ? cachedCandidates(cachedRow.candidates)
        : null

    // Discovery has no pipeline-runs row to carry a mode, so the ambient config
    // decides — the same signal the run bar shows the operator.
    const mode = pipelineConfig.mockMode ? 'mock' : 'live'
    const tenant = await loadTenantContextCms(payload, mode)
    const candidates =
      usableCache ??
      (await createAhrefsClient(mode, tenant.profile).discoverKeywords(
        term,
        25,
      ))
    if (candidates.length === 0) {
      return { ok: false, error: `No keywords came back for "${term}". Try a broader phrase.` }
    }

    const fetchedAt = usableCache ? String(cachedRow!.fetchedAt) : new Date().toISOString()
    const settings = await payload.findGlobal({slug:'llm-settings',depth:0,overrideAccess:true})
    const model = resolveTopicRelevanceModel(settings, process.env).model
    const fingerprint = relevanceFingerprint(tenant.icps, tenant.positioning, tenant.profile)
    let relevance = null
    const reusableRelevance = usableCache && cachedRow?.relevanceFingerprint === fingerprint && cachedRow.relevanceModel === model && Array.isArray(cachedRow.relevance)
    if (tenant.icps.length) {
      relevance = reusableRelevance
        ? parseTopicRelevance({candidates:(cachedRow!.relevance as unknown[]).flatMap(raw => {
            if (!raw || typeof raw !== 'object') return []
            const r = raw as Record<string,unknown>
            return [{...r,audience:tenant.icps.find(i=>String(i.id) === String(r.audienceId))?.name ?? null}]
          })},candidates,tenant.icps,term)
        : await scoreTopicRelevance(payload,candidates,tenant,term,model)
    }
    if (!usableCache || (tenant.icps.length && !reusableRelevance)) {
      const data = {seed:term,seedKey,country,fetchedAt,resultCount:candidates.length,candidates,relevance,relevanceFingerprint:tenant.icps.length ? fingerprint : null,relevanceModel:tenant.icps.length ? model : null}
      if (cachedRow) await payload.update({collection:'topic-searches',id:cachedRow.id,overrideAccess:true,data})
      else await payload.create({collection:'topic-searches',overrideAccess:true,data})
    }
    const fitted = candidates.map((c,index) => {
      const r = relevance?.[index]
      return {...c,...(r ? {fit:r.fit,fitAudienceId:typeof r.audienceId === 'number' ? r.audienceId : null,fitReason:r.reason} : {})}
    })

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
      docs
        .filter((d) => d.archived)
        .map((d) => d.keyword?.toLowerCase())
        .filter(Boolean),
    )

    return {
      ok: true,
      seed: term,
      cached: usableCache !== null,
      fetchedAt,
      candidates: (relevance ? rankByFit(fitted) : fitted).map((c) => ({
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
    const { payload } = await requireUser('Sign in to discover topics.')
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
 *
 * Creating is not the same decision as running, so the two are reported
 * separately: the article is written whatever readiness says, and whether its
 * research started — and why not, when it did not — comes back beside it.
 */
export async function createTopicsAction(input: {
  keywords: string[]
  templateId: number
  icpId?: number | null
  /** True once a person has been shown what a live run costs and agreed. */
  confirmLiveCost?: boolean
}): Promise<CreateTopicsResult> {
  try {
    const { payload, user } = await requireUser('Sign in to discover topics.')
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
    // by fit and opportunity, so the first surviving pick is the strongest one.
    const [primary, ...secondaries] = free
    // Loaded before the create so the piece starts pointed at an audience; the
    // same call answers whether research can start at all, a few lines down.
    const setup = await loadWorkspaceSetup(payload)
    const primaryIcpId = setup.icps.find((icp) => icp.id === input.icpId)?.id ?? setup.icps.find((icp) => icp.primary)?.id ?? null
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
    // the next thing the editor sees is the brief. If the workspace cannot run
    // — missing keys, unfinished governance, or a live run nobody has agreed
    // to pay for — the piece still exists and the refusal comes back with it,
    // because "research will start once the workspace is ready" on its own
    // never told anyone what to go and fix.
    let researchQueued = false
    const { readiness } = setup
    let researchBlockedReason = gateRunReadiness(readiness, input.confirmLiveCost)
    if (!researchBlockedReason) {
      try {
        await queueRunForArticles(payload, user, [created], readiness)
        researchQueued = true
      } catch (e) {
        // `selected` runs queue behind an active one, so this is only reached
        // on a real failure; the piece is still there for a later run.
        if (!(e instanceof ActivePipelineRunError)) throw e
        researchBlockedReason = e.message
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
      researchBlockedReason,
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not create that topic.') }
  }
}
