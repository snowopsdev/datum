import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parseDraftClaims,
  parseFacetClustering,
  parseJudgeReply,
  parsePageClaims,
  parseVerifierReply,
  type BaselineClaim,
} from '../src/informationGain/lib'

const baselineClaim = (id: string, docId: string): BaselineClaim => ({
  id,
  text: `claim ${id}`,
  type: 'factual',
  excerpt: `claim ${id}`,
  entities: [],
  values: [],
  source: { kind: 'serp', docId },
  facetId: null,
})

describe('parsePageClaims', () => {
  it('parses claims, assigns prefixed ids, and stamps the source', () => {
    const claims = parsePageClaims(
      {
        claims: [
          {
            text: 'Plan A costs $5 a month.',
            type: 'factual',
            excerpt: 'Plan A costs $5 a month.',
            entities: ['Plan A', 7],
            values: ['$5'],
          },
          { text: 'Plan B feels nicer.', type: 'opinion', excerpt: 'Plan B feels nicer.' },
        ],
      },
      { docId: 'doc-1', sourceKind: 'serp', idPrefix: 'b1', url: 'https://example.com/a' },
    )

    assert.deepEqual(claims, [
      {
        id: 'b1-1',
        text: 'Plan A costs $5 a month.',
        type: 'factual',
        excerpt: 'Plan A costs $5 a month.',
        entities: ['Plan A'],
        values: ['$5'],
        source: { kind: 'serp', docId: 'doc-1', url: 'https://example.com/a' },
        facetId: null,
      },
      {
        id: 'b1-2',
        text: 'Plan B feels nicer.',
        type: 'opinion',
        excerpt: 'Plan B feels nicer.',
        entities: [],
        values: [],
        source: { kind: 'serp', docId: 'doc-1', url: 'https://example.com/a' },
        facetId: null,
      },
    ])
  })

  it('carries articleId for internal sources and omits absent source fields', () => {
    const claims = parsePageClaims(
      { claims: [{ text: 'We measured 40ms.', type: 'first_party_measurement', excerpt: '40ms' }] },
      { docId: 'article-12', sourceKind: 'internal', idPrefix: 'i12', articleId: 12 },
    )
    assert.deepEqual(claims[0]?.source, { kind: 'internal', docId: 'article-12', articleId: 12 })
  })

  it('throws when the reply has no claims array', () => {
    assert.throws(() => parsePageClaims({}, { docId: 'd', sourceKind: 'serp', idPrefix: 'p' }), {
      message: 'page claims reply must have a "claims" array',
    })
    assert.throws(
      () => parsePageClaims({ claims: 'nope' }, { docId: 'd', sourceKind: 'serp', idPrefix: 'p' }),
      /page claims reply must have a "claims" array/,
    )
    assert.throws(() => parsePageClaims(null, { docId: 'd', sourceKind: 'serp', idPrefix: 'p' }), {
      message: 'page claims reply must have a "claims" array',
    })
  })

  it('drops entries missing text, excerpt, or a known type and renumbers the survivors', () => {
    const claims = parsePageClaims(
      {
        claims: [
          { text: '', type: 'factual', excerpt: 'quoted' },
          { text: 'no excerpt', type: 'factual' },
          { text: 'blank excerpt', type: 'factual', excerpt: '   ' },
          { text: 'bad type', type: 'vibes', excerpt: 'quoted' },
          'garbage',
          { text: 'kept', type: 'definition', excerpt: 'quoted' },
        ],
      },
      { docId: 'd', sourceKind: 'serp', idPrefix: 'p' },
    )
    assert.equal(claims.length, 1)
    assert.equal(claims[0]?.id, 'p-1')
    assert.equal(claims[0]?.text, 'kept')
  })

  it('caps the claim count, defaulting to 40', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      text: `claim ${i}`,
      type: 'factual',
      excerpt: `claim ${i}`,
    }))
    const opts = { docId: 'd', sourceKind: 'serp' as const, idPrefix: 'p' }
    assert.equal(parsePageClaims({ claims: many }, opts).length, 40)
    assert.equal(parsePageClaims({ claims: many }, { ...opts, maxClaims: 3 }).length, 3)
  })
})

describe('parseFacetClustering', () => {
  const claims = [
    baselineClaim('c1', 'doc-1'),
    baselineClaim('c2', 'doc-2'),
    baselineClaim('c3', 'doc-2'),
  ]

  it('builds facets, weights, doc counts, and the claim → facet map', () => {
    const { facets, gaps, claimFacet } = parseFacetClustering(
      {
        facets: [
          {
            id: 'pricing',
            label: 'Pricing',
            description: 'What it costs.',
            claimIds: ['c1', 'c2', 'unknown'],
            matchesHint: '  pRiCiNg  ',
          },
          { label: 'Setup', description: 'Getting started.', claimIds: ['c2', 'c3'] },
        ],
        gaps: [],
      },
      claims,
      ['Pricing', 'Support'],
      3,
    )

    assert.equal(facets.length, 2)
    assert.deepEqual(facets[0], {
      id: 'pricing',
      label: 'Pricing',
      description: 'What it costs.',
      weight: 1,
      docCount: 2,
      mustHave: true,
      claimIds: ['c1', 'c2'],
    })
    // `c2` was claimed by the first facet, so the second only keeps `c3`.
    assert.deepEqual(facets[1], {
      id: 'f2',
      label: 'Setup',
      description: 'Getting started.',
      weight: 1 / 3,
      docCount: 1,
      mustHave: false,
      claimIds: ['c3'],
    })
    assert.deepEqual(gaps, [])
    assert.deepEqual([...claimFacet.entries()], [
      ['c1', 'pricing'],
      ['c2', 'pricing'],
      ['c3', 'f2'],
    ])
  })

  it('throws when the reply has no facets array', () => {
    assert.throws(() => parseFacetClustering({ gaps: [] }, claims, [], 3), {
      message: 'facet clustering reply must have a "facets" array',
    })
  })

  it('parses gaps, dropping malformed ones and nulling unknown facet references', () => {
    const { gaps } = parseFacetClustering(
      {
        facets: [{ id: 'pricing', label: 'Pricing', description: '', claimIds: ['c1'] }],
        gaps: [
          {
            facetId: 'pricing',
            label: 'Volume discounts',
            description: 'Nobody lists them.',
            evidenceHint: 'Check the pricing page.',
          },
          { facetId: 'ghost', label: 'Migration', description: 'Nobody covers it.' },
          { label: 'No description' },
          { description: 'No label' },
          'garbage',
        ],
      },
      claims,
      [],
      1,
    )

    assert.deepEqual(gaps, [
      {
        facetId: 'pricing',
        label: 'Volume discounts',
        description: 'Nobody lists them.',
        evidenceHint: 'Check the pricing page.',
      },
      {
        facetId: null,
        label: 'Migration',
        description: 'Nobody covers it.',
        evidenceHint: '',
      },
    ])
  })

  it('gives a duplicate explicit id a fresh id, keeping the first facet on it', () => {
    // Coverage keys off the id alone, so two facets sharing one would let a
    // single covered draft claim mark both as covered.
    const { facets, claimFacet } = parseFacetClustering(
      {
        facets: [
          { id: 'pricing', label: 'Pricing', description: '', claimIds: ['c1'] },
          { id: 'pricing', label: 'Pricing again', description: '', claimIds: ['c2'] },
        ],
        gaps: [],
      },
      claims,
      [],
      3,
    )

    assert.deepEqual(
      facets.map((facet) => facet.id),
      ['pricing', 'f2'],
    )
    assert.deepEqual(
      facets.map((facet) => facet.claimIds),
      [['c1'], ['c2']],
    )
    // Each claim maps once, to the facet it was listed under.
    assert.deepEqual([...claimFacet.entries()], [
      ['c1', 'pricing'],
      ['c2', 'f2'],
    ])
  })

  it('does not let a generated fallback collide with an explicit id further down', () => {
    const { facets, claimFacet } = parseFacetClustering(
      {
        facets: [
          { label: 'Unnamed', description: '', claimIds: ['c1'] },
          { id: 'f1', label: 'Explicitly f1', description: '', claimIds: ['c2'] },
        ],
        gaps: [],
      },
      claims,
      [],
      3,
    )

    assert.deepEqual(
      facets.map((facet) => facet.id),
      ['f1-2', 'f1'],
    )
    assert.deepEqual([...claimFacet.entries()], [
      ['c1', 'f1-2'],
      ['c2', 'f1'],
    ])
  })

  it('keeps generated ids unique across a run of duplicates', () => {
    const { facets, claimFacet } = parseFacetClustering(
      {
        facets: [
          { id: 'pricing', label: 'A', description: '', claimIds: ['c1'] },
          { id: 'pricing', label: 'B', description: '', claimIds: ['c2'] },
          { id: 'f2', label: 'C', description: '', claimIds: ['c3'] },
        ],
        gaps: [],
      },
      claims,
      [],
      3,
    )

    // The second facet cannot take `f2` — the third facet named it — so it
    // falls through to the suffixed form, and every id is still distinct.
    const ids = facets.map((facet) => facet.id)
    assert.deepEqual(ids, ['pricing', 'f2-2', 'f2'])
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual([...claimFacet.entries()], [
      ['c1', 'pricing'],
      ['c2', 'f2-2'],
      ['c3', 'f2'],
    ])
  })

  it('caps facets at 12 and gaps at 8', () => {
    const { facets, gaps } = parseFacetClustering(
      {
        facets: Array.from({ length: 20 }, (_, i) => ({ label: `f${i}`, description: '' })),
        gaps: Array.from({ length: 12 }, (_, i) => ({ label: `g${i}`, description: 'x' })),
      },
      claims,
      [],
      3,
    )
    assert.equal(facets.length, 12)
    assert.equal(gaps.length, 8)
    assert.equal(facets[11]?.id, 'f12')
  })
})

describe('parseDraftClaims', () => {
  const plainText = 'Setup takes ten minutes. The free tier allows 3 seats. We saw 40ms latency.'
  const facetIds = new Set(['pricing', 'setup'])

  it('parses claims, pads ids, checks excerpts, and filters unknown facets', () => {
    const claims = parseDraftClaims(
      {
        claims: [
          {
            text: 'The free tier allows three seats.',
            type: 'factual',
            excerpt: 'The free tier allows 3 seats.',
            section: 'Pricing',
            facetId: 'pricing',
            entities: ['free tier', null],
            values: ['3'],
          },
          {
            text: 'Latency was excellent.',
            type: 'opinion',
            excerpt: 'this sentence is not in the draft',
            facetId: 'unknown-facet',
          },
        ],
      },
      plainText,
      facetIds,
    )

    assert.deepEqual(claims, [
      {
        id: 'c001',
        text: 'The free tier allows three seats.',
        type: 'factual',
        excerpt: 'The free tier allows 3 seats.',
        section: 'Pricing',
        facetId: 'pricing',
        entities: ['free tier'],
        values: ['3'],
        restatesClaimId: null,
        excerptFound: true,
      },
      {
        id: 'c002',
        text: 'Latency was excellent.',
        type: 'opinion',
        excerpt: 'this sentence is not in the draft',
        section: null,
        facetId: null,
        entities: [],
        values: [],
        restatesClaimId: null,
        excerptFound: false,
      },
    ])
  })

  it('throws when the reply has no claims array', () => {
    assert.throws(() => parseDraftClaims({ claims: {} }, plainText, facetIds), {
      message: 'draft claims reply must have a "claims" array',
    })
  })

  it('resolves restatesClaimIndex against the pre-filter index, across a dropped entry', () => {
    const claim = (text: string, extra: Record<string, unknown> = {}) => ({
      text,
      type: 'factual',
      excerpt: text,
      ...extra,
    })
    const claims = parseDraftClaims(
      {
        claims: [
          claim('raw 0 kept'),
          { text: 'raw 1 dropped', type: 'factual' },
          claim('raw 2 restates raw 0', { restatesClaimIndex: 0 }),
          claim('raw 3 restates the dropped raw 1', { restatesClaimIndex: 1 }),
          claim('raw 4 restates itself', { restatesClaimIndex: 4 }),
          claim('raw 5 restates a forward claim', { restatesClaimIndex: 6 }),
          claim('raw 6 restates out of range', { restatesClaimIndex: 99 }),
          claim('raw 7 restates a non-integer', { restatesClaimIndex: 1.5 }),
        ],
      },
      plainText,
      facetIds,
    )

    assert.deepEqual(
      claims.map((c) => [c.id, c.restatesClaimId]),
      [
        ['c001', null],
        ['c002', 'c001'],
        ['c003', null],
        ['c004', null],
        ['c005', null],
        ['c006', null],
        ['c007', null],
      ],
    )
  })

  it('drops malformed entries and caps the count', () => {
    const many = Array.from({ length: 70 }, (_, i) => ({
      text: `claim ${i}`,
      type: 'factual',
      excerpt: `claim ${i}`,
    }))
    assert.equal(parseDraftClaims({ claims: many }, plainText, facetIds).length, 60)
    assert.equal(parseDraftClaims({ claims: many }, plainText, facetIds, 2).length, 2)
    assert.equal(
      parseDraftClaims(
        { claims: [{ text: 'x', type: 'nonsense', excerpt: 'x' }, 5] },
        plainText,
        facetIds,
      ).length,
      0,
    )
  })
})

describe('parseJudgeReply', () => {
  const queryIds = new Set(['q0', 'q1'])
  const baselineIds = new Set(['b1-1', 'i12-1'])

  it('clamps every signal and keeps only known ids', () => {
    const signals = parseJudgeReply(
      {
        claims: [
          {
            claimId: 'c001',
            duplicateProbability: 1.4,
            closestBaselineClaimId: 'b1-1',
            internalDuplicateProbability: -2,
            closestInternalClaimId: 'i12-1',
            relevanceByQuery: { q0: 0.9, q1: 3, q9: 1 },
            utility: {
              specificity: 0.8,
              actionability: 'high',
              explanatoryPower: 0.5,
              audienceFit: 1.2,
            },
            importance: 5,
            containsNumericOrTemporalClaim: true,
            rationale: 'Adds a number nobody else publishes.',
          },
        ],
      },
      ['c001'],
      queryIds,
      baselineIds,
    )

    assert.deepEqual(signals.get('c001'), {
      duplicateProbability: 1,
      closestBaselineClaimId: 'b1-1',
      internalDuplicateProbability: 0,
      closestInternalClaimId: 'i12-1',
      relevanceByQuery: { q0: 0.9, q1: 1 },
      utility: { specificity: 0.8, actionability: 0, explanatoryPower: 0.5, audienceFit: 1 },
      importance: 2,
      containsNumericOrTemporalClaim: true,
      rationale: 'Adds a number nobody else publishes.',
    })
  })

  it('nulls unknown closest ids, defaults importance to 1, and only trusts literal true', () => {
    const signals = parseJudgeReply(
      {
        claims: [
          {
            claimId: 'c001',
            closestBaselineClaimId: 'not-a-known-claim',
            closestInternalClaimId: 42,
            containsNumericOrTemporalClaim: 'true',
          },
        ],
      },
      ['c001'],
      queryIds,
      baselineIds,
    )

    const parsed = signals.get('c001')
    assert.equal(parsed?.closestBaselineClaimId, null)
    assert.equal(parsed?.closestInternalClaimId, null)
    assert.equal(parsed?.containsNumericOrTemporalClaim, false)
    assert.equal(parsed?.importance, 1)
    assert.equal(parsed?.duplicateProbability, 0)
    assert.deepEqual(parsed?.relevanceByQuery, {})
    assert.deepEqual(parsed?.utility, {
      specificity: 0,
      actionability: 0,
      explanatoryPower: 0,
      audienceFit: 0,
    })
    assert.equal(parsed?.rationale, '')
  })

  it('throws on a bad shape and on a missing expected claim, but ignores extras', () => {
    assert.throws(() => parseJudgeReply({}, ['c001'], queryIds, baselineIds), {
      message: 'judge reply must have a "claims" array',
    })
    assert.throws(
      () =>
        parseJudgeReply(
          { claims: [{ claimId: 'c001' }] },
          ['c001', 'c002'],
          queryIds,
          baselineIds,
        ),
      { message: 'judge reply missing claim c002' },
    )

    const signals = parseJudgeReply(
      { claims: [{ claimId: 'c001' }, { claimId: 'c999' }] },
      ['c001'],
      queryIds,
      baselineIds,
    )
    assert.deepEqual([...signals.keys()], ['c001'])
  })
})

describe('parseVerifierReply', () => {
  it('parses support, contradiction, and evidence', () => {
    const signals = parseVerifierReply(
      {
        claims: [
          {
            claimId: 'c001',
            support: 0.9,
            contradiction: 1.5,
            evidence: [
              {
                url: 'https://docs.example.com/pricing',
                excerpt: 'The free tier allows 3 seats.',
                publisher: 'Example Docs',
                sourceKind: 'official_docs',
              },
            ],
            notes: 'Confirmed on the pricing page.',
          },
        ],
      },
      ['c001'],
    )

    assert.deepEqual(signals.get('c001'), {
      support: 0.9,
      contradiction: 1,
      evidence: [
        {
          url: 'https://docs.example.com/pricing',
          excerpt: 'The free tier allows 3 seats.',
          publisher: 'Example Docs',
          sourceKind: 'official_docs',
        },
      ],
      notes: 'Confirmed on the pricing page.',
    })
  })

  it('throws on a bad shape but returns zeros for a missing claim', () => {
    assert.throws(() => parseVerifierReply({ claims: null }, ['c001']), {
      message: 'verifier reply must have a "claims" array',
    })
    const signals = parseVerifierReply({ claims: [] }, ['c001', 'c002'])
    assert.deepEqual(signals.get('c001'), {
      support: 0,
      contradiction: 0,
      evidence: [],
      notes: null,
    })
    assert.deepEqual([...signals.keys()], ['c001', 'c002'])
  })

  it('drops unusable evidence and forces support to 0 when nothing survives', () => {
    const signals = parseVerifierReply(
      {
        claims: [
          {
            claimId: 'c001',
            support: 0.95,
            contradiction: 0.1,
            evidence: [
              { url: 'not a url', excerpt: 'Something.' },
              { url: 'https://example.com/a', excerpt: '   ' },
              { url: 'https://example.com/b' },
              'garbage',
            ],
          },
        ],
      },
      ['c001'],
    )

    assert.deepEqual(signals.get('c001'), {
      support: 0,
      contradiction: 0.1,
      evidence: [],
      notes: null,
    })
  })

  it('downgrades a claimed first_party_dataset and any unknown class to "unknown"', () => {
    const signals = parseVerifierReply(
      {
        claims: [
          {
            claimId: 'c001',
            support: 0.5,
            evidence: [
              {
                url: 'https://example.com/a',
                excerpt: 'Our own numbers.',
                sourceKind: 'first_party_dataset',
              },
              { url: 'https://example.com/b', excerpt: 'Elsewhere.', sourceKind: 'made_up' },
              { url: 'https://example.com/c', excerpt: 'Primary.', sourceKind: 'primary' },
            ],
          },
        ],
      },
      ['c001'],
    )

    assert.deepEqual(
      signals.get('c001')?.evidence.map((e) => [e.sourceKind, e.publisher]),
      [
        ['unknown', null],
        ['unknown', null],
        ['primary', null],
      ],
    )
    assert.equal(signals.get('c001')?.support, 0.5)
  })
})
