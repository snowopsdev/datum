import { config } from './config'

export interface GapKeyword {
  keyword: string
  volume: number
  difficulty: number
  bestCompetitorPosition: number
}

export interface SerpResearch {
  rankingPagesSummary: string
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
}

const API_BASE = 'https://api.ahrefs.com/v3'

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
    return { rankingPagesSummary, commonSubtopics, relatedQuestions }
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

  async serpResearch(keyword: string): Promise<SerpResearch> {
    return {
      rankingPagesSummary: [
        `#1 The complete guide to ${keyword} — https://competitor-one.com/blog/${keyword.replace(/\s+/g, '-')} (DR 78)`,
        `#2 ${keyword}: what actually works in 2026 — https://competitor-two.com/${keyword.replace(/\s+/g, '-')} (DR 71)`,
        `#3 10 lessons from doing ${keyword} the hard way — https://industry-mag.example.com/lessons (DR 66)`,
      ].join('\n'),
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

export function createAhrefsClient(): AhrefsClient {
  if (config.mockMode || !config.ahrefsApiKey) return new MockAhrefsClient()
  return new RealAhrefsClient(config.ahrefsApiKey)
}
