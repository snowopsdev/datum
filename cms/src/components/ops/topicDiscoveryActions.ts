'use server'

import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import { createAhrefsClient, type DiscoveredKeyword } from '../../../../pipeline/src/ahrefs'

const BOARD_PATH = '/admin/ops/articles'

/** What the panel shows for one candidate, plus whether it is already taken. */
export interface TopicCandidate extends DiscoveredKeyword {
  /** True when an article already exists for this keyword — pipeline:fetch skips those too. */
  alreadyTaken: boolean
}

export type DiscoverResult =
  | { ok: true; seed: string; candidates: TopicCandidate[] }
  | { ok: false; error: string }

export type CreateTopicsResult = { ok: true; created: number } | { ok: false; error: string }

async function requireUser() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers })
  if (!user) throw new Error('Sign in to discover topics.')
  return { payload, user }
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
export async function discoverTopicsAction(seed: string): Promise<DiscoverResult> {
  try {
    const term = seed.trim()
    if (!term) return { ok: false, error: 'Type a topic to search for.' }
    const { payload } = await requireUser()

    const candidates = await createAhrefsClient().discoverKeywords(term, 25)
    if (candidates.length === 0) {
      return { ok: false, error: `No keywords came back for "${term}". Try a broader phrase.` }
    }

    // Mark the ones that already have an article rather than hiding them: a
    // keyword being taken is useful information, and silently dropping rows
    // makes the list look arbitrarily short.
    const { docs } = await payload.find({
      collection: 'articles',
      where: { keyword: { in: candidates.map((c) => c.keyword) } },
      pagination: false,
      depth: 0,
      limit: 500,
    })
    const taken = new Set(docs.map((d) => d.keyword?.toLowerCase()).filter(Boolean))

    return {
      ok: true,
      seed: term,
      candidates: candidates.map((c) => ({
        ...c,
        alreadyTaken: taken.has(c.keyword.toLowerCase()),
      })),
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not search for topics.') }
  }
}

/**
 * Create `topic_selected` articles for the keywords the operator ticked.
 *
 * The template is assigned here rather than later because `runPipeline` only
 * touches articles that already have one — an article created without a
 * template is invisible to every stage until somebody assigns one by hand.
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

    let created = 0
    for (const keyword of wanted) {
      if (taken.has(keyword.toLowerCase())) continue
      await payload.create({
        collection: 'articles',
        data: { keyword, title: keyword, status: 'topic_selected', template: input.templateId },
        user,
        overrideAccess: false,
        context: {
          articleAudit: {
            actor: typeof user.email === 'string' ? user.email : String(user.id),
            actorType: 'user' as const,
            event: 'topic_selected_by_user',
            summary: 'Topic chosen from discovery',
            details: { keyword, source: 'topic-discovery' },
          },
        },
      })
      created += 1
    }

    if (created === 0) {
      return { ok: false, error: 'Every topic you picked already has an article.' }
    }
    revalidatePath(BOARD_PATH)
    return { ok: true, created }
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Could not create those topics.') }
  }
}
