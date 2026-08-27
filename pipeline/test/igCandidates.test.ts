import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  collectCandidateSightings,
  MAX_CANDIDATE_SIGHTINGS,
  matchEvidenceRule,
  mergeSightings,
  suggestClass,
  type CandidateSighting,
  type ClaimRecord,
  type Evidence,
  type EvidenceSourceRule,
  type SnapshotPageLike,
} from '../src/informationGain/lib'

const rule = (overrides: Partial<EvidenceSourceRule> = {}): EvidenceSourceRule => ({
  domain: 'example.com',
  qualityClass: 'primary',
  active: true,
  ...overrides,
})

const evidence = (overrides: Partial<Evidence> = {}): Evidence => ({
  url: 'https://cited.test/a',
  excerpt: 'an excerpt',
  publisher: null,
  sourceKind: 'secondary',
  domain: 'cited.test',
  qualityScore: 0.75,
  qualitySource: 'rubric_capped',
  ...overrides,
})

/** Only `evidence` matters here; the rest is filler the collector never reads. */
const claim = (items: Evidence[]): ClaimRecord => ({ evidence: items }) as unknown as ClaimRecord

const page = (overrides: Partial<SnapshotPageLike> = {}): SnapshotPageLike => ({
  url: 'https://ranked.test/post',
  domain: 'ranked.test',
  position: 1,
  domainRating: 55,
  ...overrides,
})

const collect = (input: {
  claims?: ClaimRecord[]
  pages?: SnapshotPageLike[]
  rules?: EvidenceSourceRule[]
}) =>
  collectCandidateSightings({
    claims: input.claims ?? [],
    pages: input.pages ?? [],
    rules: input.rules ?? [],
    articleId: 7,
    keyword: 'best crm',
    runId: 42,
    seenAt: '2026-08-26T00:00:00.000Z',
  })

const sighting = (overrides: Partial<CandidateSighting> = {}): CandidateSighting => ({
  domain: 'cited.test',
  kind: 'cited',
  articleId: 7,
  keyword: 'best crm',
  runId: 42,
  seenAt: '2026-08-26T00:00:00.000Z',
  url: 'https://cited.test/a',
  ...overrides,
})

describe('matchEvidenceRule', () => {
  it('matches a host and its subdomains, longest rule winning', () => {
    const rules = [rule({ domain: 'example.com' }), rule({ domain: 'docs.example.com' })]
    assert.equal(matchEvidenceRule('docs.example.com', rules)?.domain, 'docs.example.com')
    assert.equal(matchEvidenceRule('example.com', rules)?.domain, 'example.com')
  })

  it('ignores inactive rules and near-miss hostnames', () => {
    assert.equal(matchEvidenceRule('example.com', [rule({ active: false })]), null)
    assert.equal(matchEvidenceRule('notexample.com', [rule()]), null)
  })
})

describe('collectCandidateSightings', () => {
  it('keeps citations nobody rated and drops the ones a rule covers', () => {
    const sightings = collect({
      claims: [
        claim([
          evidence({ domain: 'rated.test', qualitySource: 'evidence-sources' }),
          evidence({ domain: 'cited.test', qualitySource: 'rubric' }),
          evidence({ domain: 'capped.test', qualitySource: 'rubric_capped' }),
        ]),
      ],
    })
    assert.deepEqual(
      sightings.map((s) => s.domain).sort(),
      ['capped.test', 'cited.test'],
    )
  })

  // A rule can cover a domain the scorer had not seen yet (added by hand since
  // the run), so the collector re-checks rather than trusting qualitySource.
  it('drops a citation covered by a rule on its parent domain', () => {
    const sightings = collect({
      claims: [claim([evidence({ domain: 'docs.example.com', qualitySource: 'rubric' })])],
      rules: [rule({ domain: 'example.com' })],
    })
    assert.deepEqual(sightings, [])
  })

  it('counts repeat citations of one domain as a single sighting', () => {
    const sightings = collect({
      claims: [
        claim([evidence({ sourceKind: 'official_docs' }), evidence({ sourceKind: 'official_docs' })]),
        claim([evidence({ sourceKind: 'official_docs' })]),
      ],
    })
    assert.equal(sightings.length, 1)
    assert.equal(sightings[0]?.citations, 3)
    assert.equal(sightings[0]?.kind, 'cited')
  })

  it('normalises the stored domain', () => {
    const sightings = collect({
      claims: [claim([evidence({ domain: 'WWW.Cited.test' })])],
    })
    assert.equal(sightings[0]?.domain, 'cited.test')
  })

  it('takes the best position when one host ranks twice', () => {
    const sightings = collect({
      pages: [page({ position: 4 }), page({ position: 2, url: 'https://ranked.test/better' })],
    })
    assert.equal(sightings.length, 1)
    assert.equal(sightings[0]?.position, 2)
    assert.equal(sightings[0]?.url, 'https://ranked.test/better')
  })

  // A page that ranks is a competitor whether or not the crawler could read it.
  it('keeps a SERP domain whose fetch failed', () => {
    const sightings = collect({
      pages: [page({ domain: 'dead.test', position: 3, domainRating: null })],
    })
    assert.equal(sightings[0]?.domain, 'dead.test')
    assert.equal(sightings[0]?.domainRating, null)
  })

  it('falls back to the URL when a page carries no domain', () => {
    const sightings = collect({ pages: [page({ domain: null, url: 'https://www.raw.test/x' })] })
    assert.equal(sightings[0]?.domain, 'raw.test')
  })

  it('reports a domain that was both cited and ranking once per kind', () => {
    const sightings = collect({
      claims: [claim([evidence({ domain: 'both.test' })])],
      pages: [page({ domain: 'both.test' })],
    })
    assert.deepEqual(sightings.map((s) => s.kind).sort(), ['cited', 'serp'])
  })
})

describe('suggestClass', () => {
  it('uses the verifier rubric a cited domain was given', () => {
    assert.equal(suggestClass([sighting({ sourceKind: 'official_docs' })]), 'official_docs')
  })

  it('takes the most common rubric across sightings', () => {
    assert.equal(
      suggestClass([
        sighting({ sourceKind: 'primary', runId: 1 }),
        sighting({ sourceKind: 'secondary', runId: 2 }),
        sighting({ sourceKind: 'secondary', runId: 3 }),
      ]),
      'secondary',
    )
  })

  it('breaks a tie toward the weaker class', () => {
    assert.equal(
      suggestClass([
        sighting({ sourceKind: 'primary', runId: 1 }),
        sighting({ sourceKind: 'secondary', runId: 2 }),
      ]),
      'secondary',
    )
  })

  it('never suggests blocking or self-certifying a domain', () => {
    assert.equal(suggestClass([sighting({ sourceKind: 'blocked' })]), 'unverified')
    assert.equal(suggestClass([sighting({ sourceKind: 'first_party_dataset' })]), 'secondary')
  })

  it('falls back to secondary when every rubric guess was unknown', () => {
    assert.equal(suggestClass([sighting({ sourceKind: 'unknown' })]), 'secondary')
  })

  it('rates a SERP-only domain by its domain rating', () => {
    const serp = (domainRating: number | null) => sighting({ kind: 'serp', domainRating })
    assert.equal(suggestClass([serp(78)]), 'secondary')
    assert.equal(suggestClass([serp(39)]), 'unverified')
    assert.equal(suggestClass([serp(null)]), 'unverified')
  })

  // Being cited says more than ranking does, so a rubric guess wins outright.
  it('prefers a citation rubric over the SERP rating', () => {
    assert.equal(
      suggestClass([sighting({ sourceKind: 'primary' }), sighting({ kind: 'serp', domainRating: 78 })]),
      'primary',
    )
  })
})

describe('mergeSightings', () => {
  it('puts the newest first and keeps one entry per kind, article and run', () => {
    const merged = mergeSightings(
      [sighting({ seenAt: '2026-08-01T00:00:00.000Z', citations: 1 })],
      [sighting({ seenAt: '2026-08-26T00:00:00.000Z', citations: 9 })],
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.citations, 9)
  })

  it('keeps sightings from different runs', () => {
    const merged = mergeSightings([sighting({ runId: 1 })], [sighting({ runId: 2 })])
    assert.equal(merged.length, 2)
  })

  it('caps the list', () => {
    const many = Array.from({ length: MAX_CANDIDATE_SIGHTINGS + 5 }, (_, i) =>
      sighting({ runId: i, seenAt: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }),
    )
    assert.equal(mergeSightings([], many).length, MAX_CANDIDATE_SIGHTINGS)
  })

  it('ignores a stored value that is not a sighting list', () => {
    assert.deepEqual(mergeSightings(null, []), [])
    assert.deepEqual(mergeSightings('nonsense', []), [])
    assert.deepEqual(mergeSightings([{ domain: 'x' }, 7], []), [])
  })
})
