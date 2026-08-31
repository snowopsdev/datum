import { config } from './config'

export interface GapKeyword {
  keyword: string
  volume: number
  difficulty: number
  bestCompetitorPosition: number
}

/** One organic SERP result, structured so the corpus builder can fetch it. */
export interface SerpPage {
  position: number
  title: string | null
  url: string
  domainRating: number | null
}

export interface SerpResearch {
  rankingPagesSummary: string
  /**
   * The same organic results `rankingPagesSummary` renders, as data. The
   * summary is prompt text; `pages` is what the information-gain corpus
   * snapshot crawls, so the two must never drift apart.
   */
  pages: SerpPage[]
  commonSubtopics: string[]
  relatedQuestions: string[]
}

export interface AhrefsClient {
  /**
   * Keywords competitors rank for in positions 1-20 (volume >= 100) that the
   * target domain does not rank for. Ahrefs API v3 has no dedicated content-gap
   * endpoint, so this is organic-keywords per competitor minus the target's own
   * organic keywords.
   */
  contentGapKeywords(): Promise<GapKeyword[]>
  serpResearch(keyword: string): Promise<SerpResearch>
  /**
   * Keywords related to a seed phrase the operator typed, for the topic
   * discovery panel. Unlike `contentGapKeywords` this is not scoped to what
   * competitors rank for — it answers "what else could we write about X",
   * which is the question someone has when they arrive with a subject rather
   * than a gap report.
   */
  discoverKeywords(seed: string, limit?: number): Promise<DiscoveredKeyword[]>
}

/** One candidate topic offered to the operator, before any article exists. */
export interface DiscoveredKeyword {
  keyword: string
  volume: number
  difficulty: number
  /** volume ÷ difficulty — the same ranking `fetchTopics` sorts gap keywords by. */
  opportunity: number
}

/** Shared so the discovery panel and `fetchTopics` rank candidates identically. */
export const opportunityScore = (volume: number, difficulty: number): number =>
  volume / Math.max(difficulty, 1)

const API_BASE = 'https://api.ahrefs.com/v3'

interface MatchingTermRow {
  keyword: string | null
  volume: number | null
  difficulty: number | null
}

interface OrganicKeywordRow {
  keyword: string | null
  volume: number | null
  keyword_difficulty: number | null
  best_position: number | null
}

interface SerpPositionRow {
  position: number
  title: string | null
  url: string | null
  type: string[]
  domain_rating: number | null
}

class RealAhrefsClient implements AhrefsClient {
  constructor(private readonly apiKey: string) {}

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}${path}`)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
    })
    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Ahrefs API ${path} failed (${response.status}): ${body.slice(0, 300)}`)
    }
    return (await response.json()) as T
  }

  private async organicKeywords(target: string, where?: string): Promise<OrganicKeywordRow[]> {
    const today = new Date().toISOString().slice(0, 10)
    const { keywords } = await this.get<{ keywords: OrganicKeywordRow[] }>(
      '/site-explorer/organic-keywords',
      {
        target,
        date: today,
        country: config.ahrefsCountry,
        select: 'keyword,volume,keyword_difficulty,best_position',
        order_by: 'volume:desc',
        limit: '200',
        ...(where ? { where } : {}),
      },
    )
    return keywords
  }

  async contentGapKeywords(): Promise<GapKeyword[]> {
    const competitorFilter = JSON.stringify({
      and: [
        { field: 'best_position', is: ['gte', 1] },
        { field: 'best_position', is: ['lte', 20] },
        { field: 'volume', is: ['gte', 100] },
      ],
    })
    const targetKeywords = new Set(
      (await this.organicKeywords(config.targetDomain))
        .map((row) => row.keyword?.toLowerCase())
        .filter((k): k is string => Boolean(k)),
    )
    const gaps = new Map<string, GapKeyword>()
    for (const competitor of config.competitorDomains) {
      for (const row of await this.organicKeywords(competitor, competitorFilter)) {
        if (!row.keyword || row.best_position === null) continue
        const key = row.keyword.toLowerCase()
        if (targetKeywords.has(key)) continue
        const existing = gaps.get(key)
        if (!existing || row.best_position < existing.bestCompetitorPosition) {
          gaps.set(key, {
            keyword: row.keyword,
            volume: row.volume ?? 0,
            difficulty: row.keyword_difficulty ?? 0,
            bestCompetitorPosition: row.best_position,
          })
        }
      }
    }
    return [...gaps.values()]
  }

  async discoverKeywords(seed: string, limit = 25): Promise<DiscoveredKeyword[]> {
    const { keywords } = await this.get<{ keywords: MatchingTermRow[] }>(
      '/keywords-explorer/matching-terms',
      {
        country: config.ahrefsCountry,
        keywords: seed,
        select: 'keyword,volume,difficulty',
        order_by: 'volume:desc',
        limit: String(Math.min(Math.max(limit, 1), 100)),
        match_mode: 'terms',
      },
    )
    return (keywords ?? [])
      .flatMap((row) => {
        const keyword = row.keyword?.trim()
        if (!keyword) return []
        const volume = row.volume ?? 0
        const difficulty = row.difficulty ?? 0
        return [{ keyword, volume, difficulty, opportunity: opportunityScore(volume, difficulty) }]
      })
      .sort((a, b) => b.opportunity - a.opportunity)
  }

  async serpResearch(keyword: string): Promise<SerpResearch> {
    const { positions } = await this.get<{ positions: SerpPositionRow[] }>(
      '/serp-overview/serp-overview',
      {
        keyword,
        country: config.ahrefsCountry,
        select: 'position,title,url,type,domain_rating',
        top_positions: '10',
      },
    )
    const organic = positions.filter((p) => p.type.includes('organic')).slice(0, 10)
    const rankingPagesSummary = organic
      .map((p) => `#${p.position} ${p.title ?? '(untitled)'} — ${p.url ?? ''} (DR ${p.domain_rating ?? '?'})`)
      .join('\n')
    // A result with no URL is not fetchable, so it cannot join the corpus.
    const pages: SerpPage[] = organic
      .flatMap((p) =>
        p.url
          ? [
              {
                position: p.position,
                title: p.title?.trim() || null,
                url: p.url,
                domainRating: p.domain_rating ?? null,
              },
            ]
          : [],
      )
      .sort((a, b) => a.position - b.position)
      .slice(0, 10)
    // Titles of ranking pages double as the observable subtopic signal at this
    // boundary; "People also ask" rows arrive as positions of type "question".
    const commonSubtopics = [
      ...new Set(organic.map((p) => p.title?.trim()).filter((t): t is string => Boolean(t))),
    ].slice(0, 8)
    const relatedQuestions = [
      ...new Set(
        positions
          .filter((p) => p.type.includes('question'))
          .map((p) => p.title?.trim())
          .filter((t): t is string => Boolean(t)),
      ),
    ].slice(0, 8)
    return { rankingPagesSummary, pages, commonSubtopics, relatedQuestions }
  }
}

class MockAhrefsClient implements AhrefsClient {
  async contentGapKeywords(): Promise<GapKeyword[]> {
    return [
      { keyword: 'best crm for small business', volume: 5400, difficulty: 42, bestCompetitorPosition: 3 },
      { keyword: 'how to migrate crm data', volume: 1300, difficulty: 18, bestCompetitorPosition: 5 },
      { keyword: 'crm implementation checklist', volume: 880, difficulty: 12, bestCompetitorPosition: 7 },
      { keyword: 'hubspot vs salesforce for startups', volume: 720, difficulty: 35, bestCompetitorPosition: 4 },
    ]
  }

  async discoverKeywords(seed: string, limit = 25): Promise<DiscoveredKeyword[]> {
    const base = seed.trim() || 'topic'
    // Shaped like real matching-terms output: the seed itself is highest
    // volume and hardest, modifiers get progressively easier.
    const rows = [
      { suffix: '', volume: 74000, difficulty: 71 },
      { suffix: ' pricing', volume: 12000, difficulty: 44 },
      { suffix: ' alternatives', volume: 8600, difficulty: 38 },
      { suffix: ' vs competitors', volume: 3200, difficulty: 29 },
      { suffix: ' for beginners', volume: 2400, difficulty: 17 },
      { suffix: ' checklist', volume: 1100, difficulty: 11 },
    ]
    return rows
      .slice(0, Math.min(Math.max(limit, 1), rows.length))
      .map(({ suffix, volume, difficulty }) => ({
        keyword: `${base}${suffix}`,
        volume,
        difficulty,
        opportunity: opportunityScore(volume, difficulty),
      }))
      .sort((a, b) => b.opportunity - a.opportunity)
  }

  async serpResearch(keyword: string): Promise<SerpResearch> {
    const slug = keyword.replace(/\s+/g, '-')
    // Hosts here must match the ones `corpus/mockPages.ts` has text for,
    // otherwise a mock snapshot crawls three copies of the generic page.
    const pages: SerpPage[] = [
      {
        position: 1,
        title: `The complete guide to ${keyword}`,
        url: `https://competitor-one.com/blog/${slug}`,
        domainRating: 78,
      },
      {
        position: 2,
        title: `${keyword}: what actually works in 2026`,
        url: `https://competitor-two.com/${slug}`,
        domainRating: 71,
      },
      {
        position: 3,
        title: `10 lessons from doing ${keyword} the hard way`,
        url: 'https://industry-mag.example.com/lessons',
        domainRating: 66,
      },
    ]
    return {
      rankingPagesSummary: pages
        .map((p) => `#${p.position} ${p.title} — ${p.url} (DR ${p.domainRating})`)
        .join('\n'),
      pages,
      commonSubtopics: [
        `What ${keyword} means in practice`,
        'Costs and typical budgets',
        'Step-by-step process overview',
        'Common mistakes and how to avoid them',
      ],
      relatedQuestions: [
        `How long does ${keyword} take?`,
        `How much does ${keyword} cost?`,
        `Can I do ${keyword} without a consultant?`,
      ],
    }
  }
}

/**
 * Run-scoped, like `createLlmClient(mode)`: the caller says which mode this
 * run is in instead of the factory reading the module-global `config.mockMode`,
 * so a queued run's mode comes from its `pipeline-runs` row. A live request
 * without a key still degrades to mock — loudly, because a "live" run silently
 * returning canned SERPs is how bad briefs get researched.
 */
export function createAhrefsClient(mode: 'mock' | 'live'): AhrefsClient {
  if (mode === 'mock') return new MockAhrefsClient()
  if (!config.ahrefsApiKey) {
    console.warn('[ahrefs] live mode requested but AHREFS_API_KEY is unset; using mock data')
    return new MockAhrefsClient()
  }
  return new RealAhrefsClient(config.ahrefsApiKey)
}
