import { describe, expect, it } from 'vitest'

import {
  MAX_SERP_BADGES,
  queueBucket,
  toCandidateDTO,
  type ArticleLookup,
} from '@/components/ops/sourceReviewTypes'
import type { EvidenceSourceCandidate } from '@/payload-types'

const candidate = (overrides: Partial<EvidenceSourceCandidate> = {}): EvidenceSourceCandidate =>
  ({
    id: 1,
    domain: 'cited.test',
    status: 'pending',
    suggestedClass: 'secondary',
    citationCount: 3,
    serpCount: 1,
    domainRating: 55,
    lastSeenAt: '2026-08-26T00:00:00.000Z',
    sightings: [],
    ...overrides,
  }) as EvidenceSourceCandidate

const sighting = (overrides: Record<string, unknown> = {}) => ({
  domain: 'cited.test',
  kind: 'cited',
  articleId: 7,
  keyword: 'best crm',
  runId: 42,
  seenAt: '2026-08-26T00:00:00.000Z',
  url: 'https://cited.test/a',
  citations: 2,
  ...overrides,
})

describe('toCandidateDTO', () => {
  it('degrades instead of throwing on a malformed sightings column', () => {
    for (const sightings of [null, 'nonsense', 42, [null, 7, { nope: true }]]) {
      const dto = toCandidateDTO(candidate({ sightings } as never), [])
      expect(dto.serpBadges).toEqual([])
      expect(dto.citedBy).toEqual([])
    }
  })

  it('survives missing counts and an unparseable timestamp', () => {
    const dto = toCandidateDTO(
      candidate({ citationCount: null, serpCount: null, domainRating: null, lastSeenAt: 'nope' }),
      [],
    )
    expect(dto.citationCount).toBe(0)
    expect(dto.serpCount).toBe(0)
    expect(dto.domainRating).toBeNull()
    expect(dto.lastSeenLabel).toBe('—')
  })

  // One keyword is one fact about that keyword, however many of its pages rank.
  it('keeps the best position per keyword, strongest first', () => {
    const dto = toCandidateDTO(
      candidate({
        sightings: [
          sighting({ kind: 'serp', keyword: 'best crm', position: 4 }),
          sighting({ kind: 'serp', keyword: 'best crm', position: 2, runId: 43 }),
          sighting({ kind: 'serp', keyword: 'crm pricing', position: 1, runId: 44 }),
        ],
      } as never),
      [],
    )
    expect(dto.serpBadges).toEqual([
      { keyword: 'crm pricing', position: 1 },
      { keyword: 'best crm', position: 2 },
    ])
  })

  it('caps the badges and counts what it hid', () => {
    const many = Array.from({ length: MAX_SERP_BADGES + 2 }, (_, i) =>
      sighting({ kind: 'serp', keyword: `keyword ${i}`, position: i + 1, runId: i }),
    )
    const dto = toCandidateDTO(candidate({ sightings: many } as never), [])
    expect(dto.serpBadges).toHaveLength(MAX_SERP_BADGES)
    expect(dto.hiddenSerpBadges).toBe(2)
  })

  it('totals citations per article, most first', () => {
    const articles: ArticleLookup = new Map([
      [7, { title: 'Best CRM', keyword: 'best crm', status: 'blocked' }],
    ])
    const dto = toCandidateDTO(
      candidate({
        sightings: [
          sighting({ articleId: 7, citations: 2 }),
          sighting({ articleId: 7, citations: 3, runId: 43 }),
          sighting({ articleId: 9, citations: 1, runId: 44 }),
        ],
      } as never),
      [],
      articles,
    )
    expect(dto.citedBy[0]).toMatchObject({
      articleId: 7,
      label: 'Best CRM',
      href: '/admin/ops/articles/7',
      status: 'blocked',
      citations: 5,
    })
    // An article the lookup does not know still gets a readable row.
    expect(dto.citedBy[1]).toMatchObject({ articleId: 9, label: 'best crm', status: null })
  })

  it('falls back to the article id when nothing names it', () => {
    const dto = toCandidateDTO(
      candidate({ sightings: [sighting({ articleId: 9, keyword: '' })] } as never),
      [],
    )
    expect(dto.citedBy[0]?.label).toBe('Article 9')
  })

  // The live rules decide coverage, not `status`: a rule added or deactivated
  // by hand never touches a candidate row.
  it('reports a subdomain as covered by its parent rule', () => {
    const dto = toCandidateDTO(candidate({ domain: 'docs.cited.test' }), [
      { id: 5, domain: 'cited.test', qualityClass: 'primary', active: true },
    ])
    expect(dto.coveredBy).toEqual({
      domain: 'cited.test',
      qualityClass: 'primary',
      href: '/admin/collections/evidence-sources/5',
    })
  })

  it('does not count a deactivated rule as coverage', () => {
    const dto = toCandidateDTO(candidate(), [
      { id: 5, domain: 'cited.test', qualityClass: 'primary', active: false },
    ])
    expect(dto.coveredBy).toBeNull()
  })
})

describe('queueBucket', () => {
  const dto = (overrides: Partial<ReturnType<typeof toCandidateDTO>>) =>
    ({ ...toCandidateDTO(candidate(), []), ...overrides }) as ReturnType<typeof toCandidateDTO>

  it('puts an unrated pending candidate up for review', () => {
    expect(queueBucket(dto({ status: 'pending', coveredBy: null }))).toBe('review')
  })

  // Somebody rated it, just not from this page — it is not outstanding work.
  it('treats a pending candidate an active rule covers as rated', () => {
    expect(
      queueBucket(
        dto({ status: 'pending', coveredBy: { domain: 'cited.test', qualityClass: 'primary', href: null } }),
      ),
    ).toBe('rated')
  })

  it('keeps a dismissal out of the review list', () => {
    expect(queueBucket(dto({ status: 'dismissed', coveredBy: null }))).toBe('dismissed')
  })
})
