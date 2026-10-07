/**
 * Audience fit for discovered topics.
 *
 * Ahrefs stays the source of the candidates and their opportunity; this only
 * labels each one `strong`, `partial` or `off` for the workspace's active
 * audiences, so discovery can offer the topics somebody in the audience
 * actually searches for first. A label never removes a candidate from the
 * list: an `off` topic is still shown, collapsed, and still pickable.
 *
 * Dependency-free like the rest of `lib/tenant/` (`node:crypto` aside, as in
 * the barrel): the discovery action, its tests, and the CLI's exclusion filter
 * all import it.
 */

import { createHash } from 'node:crypto'

import { icpToPrompt, type IcpContent } from './icp'
import { emptyPositioningContent, positioningToPrompt, type PositioningContent } from './positioning'
import { workspaceProfileToPrompt, type ResolvedWorkspaceProfile } from './workspaceProfile'

export type TopicFit = 'strong' | 'partial' | 'off'

export interface TopicRelevance {
  keyword: string
  fit: TopicFit
  audienceId: number | string | null
  reason: string
  /** `model`, `excluded` (a "Not our user" match), or `unscored` (the model said nothing usable). */
  source: 'model' | 'excluded' | 'unscored'
}

export type RelevanceCandidate = { keyword: string; volume?: number }

const FITS: readonly TopicFit[] = ['strong', 'partial', 'off']

const STOPWORDS = new Set(
  'a an and are as at be been but by do does for from has have in into is it its no not of on or our than that the their them these they this those to use users user was we when where which who with without your people readers'.split(
    ' ',
  ),
)

const tokens = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []

/** "roasters" and "roaster", "agencies" and "agency", are one word for matching. */
const stem = (word: string): string =>
  word.endsWith('ies') && word.length > 4
    ? `${word.slice(0, -3)}y`
    : word.endsWith('s') && !word.endsWith('ss') && word.length > 4
      ? word.slice(0, -1)
      : word

/** Words long and specific enough to say something about who a phrase is about. */
const distinctiveStems = (text: string): Set<string> =>
  new Set(
    tokens(text)
      .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
      .map(stem),
  )

const key = (text: string): string => text.trim().toLowerCase()

/**
 * Every word the active audiences use to describe themselves. None of these can
 * be what makes somebody *not* our user: "coffee" in "Industrial coffee
 * roasters" also describes the home barista the workspace writes for.
 */
function audienceVocabulary(icps: IcpContent[]): Set<string> {
  const text = icps.flatMap((icp) => [
    icp.name,
    icp.who,
    ...icp.pains.map((pain) => pain.statement),
    icp.motivation.text,
    icp.solution.mechanism,
  ])
  return distinctiveStems(text.join(' '))
}

/** A row's words that say who is excluded, after dropping what the audiences and the seed share. */
function exclusionWords(row: string, vocabulary: Set<string>, seed: Set<string>): Set<string> {
  return new Set([...distinctiveStems(row)].filter((word) => !vocabulary.has(word) && !seed.has(word)))
}

/**
 * Which "Not our user" row a keyword names, or null.
 *
 * This verdict overrides the model's, and in the CLI it drops the topic without
 * anybody seeing it, so it is deliberately conservative. A keyword must carry
 * two of the row's distinguishing words — or the only one, for a one-word row
 * like "Agencies" — after the seed's words and every word an active audience
 * uses about itself are set aside. One shared word is the model's job to weigh:
 * "best coffee grinder" shares "coffee" with "Industrial coffee roasters" and is
 * exactly what a home barista searches for.
 */
export function notOurUserMatch(keyword: string, icps: IcpContent[], seed = ''): string | null {
  const vocabulary = audienceVocabulary(icps)
  const seedWords = distinctiveStems(seed)
  const words = new Set(tokens(keyword).map(stem))
  for (const icp of icps) {
    for (const row of icp.notOurUser) {
      const excluded = exclusionWords(row, vocabulary, seedWords)
      if (excluded.size === 0) continue
      const hits = [...excluded].filter((word) => words.has(word)).length
      if (hits >= Math.min(2, excluded.size)) return row
    }
  }
  return null
}

const unscored = (keyword: string): TopicRelevance => ({
  keyword,
  fit: 'partial',
  audienceId: null,
  reason: 'Not scored',
  source: 'unscored',
})

/**
 * Read a model reply into one verdict per candidate, in candidate order.
 *
 * Never drops a candidate — the list is Ahrefs data, not the model's — and
 * never throws. A candidate the model skipped, mislabelled, or matched to an
 * audience that does not exist comes back `unscored`. The deterministic
 * exclusion is applied last and wins.
 */
export function parseTopicRelevance(
  json: unknown,
  candidates: RelevanceCandidate[],
  icps: IcpContent[],
  seed = '',
): TopicRelevance[] {
  const rows =
    json && typeof json === 'object' && 'candidates' in json && Array.isArray(json.candidates)
      ? (json.candidates as unknown[])
      : []
  const replies = new Map<string, Record<string, unknown>>()
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    if (typeof row.keyword === 'string' && !replies.has(key(row.keyword))) {
      replies.set(key(row.keyword), row)
    }
  }
  return candidates.map((candidate) => {
    const excluded = notOurUserMatch(candidate.keyword, icps, seed)
    if (excluded) return excludedVerdict(candidate.keyword, excluded)
    const row = replies.get(key(candidate.keyword))
    const audience =
      typeof row?.audience === 'string'
        ? icps.find((icp) => key(icp.name) === key(row.audience as string))
        : null
    const fit = row?.fit as TopicFit
    if (
      !row ||
      !FITS.includes(fit) ||
      typeof row.reason !== 'string' ||
      !row.reason.trim() ||
      (row.audience != null && !audience)
    ) {
      return unscored(candidate.keyword)
    }
    return {
      keyword: candidate.keyword,
      fit,
      audienceId: audience?.id ?? null,
      reason: row.reason.trim(),
      source: 'model',
    }
  })
}

const excludedVerdict = (keyword: string, row: string): TopicRelevance => ({
  keyword,
  fit: 'off',
  audienceId: null,
  reason: `Not our user: ${row}`,
  source: 'excluded',
})

/**
 * Verdicts stored on a `topic-searches` row, read back for a cache hit.
 *
 * Read by audience id, not re-parsed through the model-reply path: names are
 * matched case-insensitively there, so two audiences named alike would collapse
 * into the first. Returns null when the stored list does not line up with the
 * candidates, so the caller re-scores instead of trusting it. The exclusion is
 * re-applied because it is cheap and its rule may have changed since.
 */
export function cachedTopicRelevance(
  stored: unknown,
  candidates: RelevanceCandidate[],
  icps: IcpContent[],
  seed = '',
): TopicRelevance[] | null {
  if (!Array.isArray(stored)) return null
  const byKeyword = new Map<string, TopicRelevance>()
  for (const raw of stored) {
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Record<string, unknown>
    const audienceId =
      typeof row.audienceId === 'number' || typeof row.audienceId === 'string' ? row.audienceId : null
    if (
      typeof row.keyword !== 'string' ||
      !FITS.includes(row.fit as TopicFit) ||
      typeof row.reason !== 'string' ||
      !['model', 'excluded', 'unscored'].includes(String(row.source)) ||
      (audienceId !== null && !icps.some((icp) => String(icp.id) === String(audienceId)))
    ) {
      return null
    }
    byKeyword.set(key(row.keyword), {
      keyword: row.keyword,
      fit: row.fit as TopicFit,
      audienceId,
      reason: row.reason,
      source: row.source as TopicRelevance['source'],
    })
  }
  const verdicts: TopicRelevance[] = []
  for (const candidate of candidates) {
    const excluded = notOurUserMatch(candidate.keyword, icps, seed)
    if (excluded) {
      verdicts.push(excludedVerdict(candidate.keyword, excluded))
      continue
    }
    const cached = byKeyword.get(key(candidate.keyword))
    if (!cached) return null
    verdicts.push(
      cached.source === 'excluded' ? unscored(candidate.keyword) : { ...cached, keyword: candidate.keyword },
    )
  }
  return verdicts
}

/**
 * Mock-mode scoring, standing in for the model.
 *
 * Deterministic so tests and the demo agree. Like the model it is told to be,
 * it reads one "Not our user" word as a strong `off` signal (the deterministic
 * exclusion needs two), calls a topic `strong` when it shares a word with an
 * audience's description or pains, and `partial` otherwise.
 */
export function mockTopicRelevance(
  candidates: RelevanceCandidate[],
  icps: IcpContent[],
  seed = '',
): TopicRelevance[] {
  const vocabulary = audienceVocabulary(icps)
  const seedWords = distinctiveStems(seed)
  return parseTopicRelevance(
    {
      candidates: candidates.map((candidate) => {
        const words = new Set(tokens(candidate.keyword).map(stem))
        const fenced = icps
          .flatMap((icp) => icp.notOurUser)
          .find((row) => [...exclusionWords(row, vocabulary, seedWords)].some((w) => words.has(w)))
        if (fenced) {
          return { keyword: candidate.keyword, fit: 'off', audience: null, reason: `Looks aimed at: ${fenced}` }
        }
        const icp = icps.find((audience) =>
          [...distinctiveStems([audience.who, ...audience.pains.map((p) => p.statement)].join(' '))].some(
            (word) => words.has(word),
          ),
        )
        return {
          keyword: candidate.keyword,
          fit: icp ? 'strong' : 'partial',
          audience: icp?.name ?? null,
          reason: icp ? `Matches ${icp.name}'s needs` : 'Some overlap; check the angle',
        }
      }),
    },
    candidates,
    icps,
    seed,
  )
}

/** Fit bucket first, then opportunity; stable, so equal rows keep Ahrefs' order. */
export function rankByFit<T extends { fit?: TopicFit; opportunity: number }>(candidates: T[]): T[] {
  const order: Record<TopicFit, number> = { strong: 0, partial: 1, off: 2 }
  return [...candidates].sort(
    (a, b) => order[a.fit ?? 'partial'] - order[b.fit ?? 'partial'] || b.opportunity - a.opportunity,
  )
}

/**
 * What a cached verdict was scored against. Built from the same rendered blocks
 * the scoring prompt sends — the workspace, every audience, the positioning —
 * which are deterministic by design, so any edit the scorer would see moves it
 * and a re-save of unchanged content does not.
 */
export function relevanceFingerprint(
  icps: IcpContent[],
  positioning: PositioningContent | null,
  profile: ResolvedWorkspaceProfile,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        icps.map((icp) => [icp.id, icpToPrompt(icp)]),
        positioningToPrompt(positioning),
        workspaceProfileToPrompt(profile),
      ]),
    )
    .digest('hex')
}

/**
 * The scoring prompt. Positioning is cut to its category and pillars: the
 * rest is how the company describes itself, which says nothing about whether
 * a search belongs to its audience.
 */
export function buildTopicRelevancePrompt(input: {
  icps: IcpContent[]
  positioning: PositioningContent | null
  profile: ResolvedWorkspaceProfile
  candidates: RelevanceCandidate[]
}): { system: string; user: string } {
  return {
    system:
      'Label each candidate strong, partial, or off for the active audiences. Not our user is the strongest off signal. Choose the best-fitting audience by its exact name, or null. Return JSON only: {"candidates":[{"keyword":string,"fit":"strong"|"partial"|"off","audience":string|null,"reason":string}]}. Give one short reason per keyword. Do not invent candidates.',
    user: [
      workspaceProfileToPrompt(input.profile),
      ...input.icps.map((icp) => icpToPrompt(icp)),
      positioningToPrompt(
        input.positioning
          ? {
              ...emptyPositioningContent(),
              category: input.positioning.category,
              pillars: input.positioning.pillars,
            }
          : null,
      ),
      `# Candidates\n${input.candidates.map((c) => `- ${c.keyword} (volume: ${c.volume ?? 0})`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  }
}
