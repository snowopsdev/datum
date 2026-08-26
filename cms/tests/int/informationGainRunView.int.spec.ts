import { describe, expect, it } from 'vitest'

import type { ScorecardClaim } from '@/components/ops/articleStatus'
import {
  MAX_RENDERED_CLAIMS,
  selectRenderedClaims,
  toRunView,
} from '@/components/ops/articleStatus'
import type { InformationGainRun } from '@/payload-types'

/**
 * `toRunView` is the mapper every number on the scorecard passes through, and
 * the run's `reasons`/`claims`/`claimIds` are free-form `json` columns, so the
 * contract worth locking is that malformed input degrades instead of throwing
 * or leaking `undefined` into the page.
 */

function run(overrides: Partial<InformationGainRun> = {}): InformationGainRun {
  return {
    id: 1,
    article: 7,
    pipelineRunId: 'run-1',
    policyVersion: 'ig-v1:abc',
    decision: 'PASS',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  } as InformationGainRun
}

function claim(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    text: `text ${id}`,
    excerpt: `excerpt ${id}`,
    section: 'Introduction',
    kind: 'factual',
    novelty: 0.5,
    relevance: 0.6,
    utility: 0.7,
    intraDocumentNovelty: 0.8,
    verificationMode: 'verified',
    evidence: [],
    scored: { potentialGain: 0.1, verifiedGain: 0.09, evidenceIntegrity: 0.95, reasons: [] },
    ...extra,
  }
}

function scorecardClaim(id: string, extra: Partial<ScorecardClaim> = {}): ScorecardClaim {
  return {
    id,
    text: `text ${id}`,
    excerpt: `excerpt ${id}`,
    section: null,
    kind: 'factual',
    novelty: null,
    relevance: null,
    utility: null,
    intraDocumentNovelty: null,
    potentialGain: null,
    verifiedGain: null,
    evidenceIntegrity: null,
    verificationMode: 'verified',
    blocked: false,
    requiresHumanReview: false,
    materiallyNovel: false,
    verifiedNovel: false,
    evidence: [],
    reasons: [],
    ...extra,
  }
}

describe('toRunView — full run', () => {
  const view = toRunView(
    run({
      decision: 'HUMAN_REVIEW',
      calibrated: false,
      baselineAvailable: true,
      tokenCount: 1200,
      costUsd: 0.42,
      scores: {
        consensusCoverage: 1,
        potentialGainUnits: 2.5,
        verifiedGainUnits: 2.08,
        verificationRatio: 0.96,
        verifiedGainDensity: 5.835,
        facetGainCoverage: 0.4,
        internalDuplicationRate: 0,
      },
      claimSummary: {
        totalClaims: 2,
        materiallyNovelClaims: 1,
        verifiedNovelClaims: 1,
        unsupportedNovelClaims: 0,
        contradictoryClaims: 1,
        firstPartyClaims: 0,
      },
      claimIds: {
        materiallyNovel: ['c001'],
        verifiedNovel: ['c001'],
        blocked: [],
        review: ['c002'],
      },
      reasons: [
        {
          policy: 'CONTRADICTION_REQUIRES_REVIEW',
          claimId: 'c002',
          message: 'Contradiction probability was 0.05; maximum is 0.01.',
          severity: 'HUMAN_REVIEW',
        },
      ],
      claims: [
        claim('c001', {
          evidence: [
            {
              url: 'https://sca.coffee/research/x',
              domain: 'sca.coffee',
              publisher: 'SCA',
              excerpt: 'evidence text',
              sourceKind: 'official_docs',
              qualityScore: 0.95,
              qualitySource: 'evidence-sources',
            },
          ],
        }),
        claim('c002', {
          scored: {
            potentialGain: 0.64,
            verifiedGain: 0.61,
            evidenceIntegrity: 0.95,
            requiresHumanReview: true,
            blocked: false,
            reasons: [
              {
                policy: 'CONTRADICTION_REQUIRES_REVIEW',
                claimId: 'c002',
                message: 'Contradiction probability was 0.05; maximum is 0.01.',
                severity: 'HUMAN_REVIEW',
              },
            ],
          },
        }),
      ],
    }),
  )

  it('maps identity, decision and policy metadata', () => {
    expect(view.id).toBe(1)
    expect(view.decision).toBe('HUMAN_REVIEW')
    expect(view.policyVersion).toBe('ig-v1:abc')
    expect(view.calibrated).toBe(false)
    expect(view.baselineAvailable).toBe(true)
    expect(view.createdAtLabel).toContain('UTC')
    expect(view.tokenCount).toBe(1200)
    expect(view.costUsd).toBe(0.42)
  })

  it('maps every score, keeping consensusCoverage and facetGainCoverage distinct', () => {
    expect(view.scores).toEqual({
      consensusCoverage: 1,
      potentialGainUnits: 2.5,
      verifiedGainUnits: 2.08,
      verificationRatio: 0.96,
      verifiedGainDensity: 5.835,
      facetGainCoverage: 0.4,
      internalDuplicationRate: 0,
    })
  })

  it('maps the claim summary', () => {
    expect(view.claimSummary.totalClaims).toBe(2)
    expect(view.claimSummary.contradictoryClaims).toBe(1)
    expect(view.claimSummary.firstPartyClaims).toBe(0)
  })

  it('maps reasons with their claimId intact', () => {
    expect(view.reasons).toHaveLength(1)
    expect(view.reasons[0]).toMatchObject({
      policy: 'CONTRADICTION_REQUIRES_REVIEW',
      claimId: 'c002',
      severity: 'HUMAN_REVIEW',
    })
  })

  it('maps per-claim signals, scores and evidence', () => {
    const c1 = view.claims.find((c) => c.id === 'c001')
    expect(c1).toMatchObject({
      excerpt: 'excerpt c001',
      section: 'Introduction',
      kind: 'factual',
      novelty: 0.5,
      relevance: 0.6,
      utility: 0.7,
      intraDocumentNovelty: 0.8,
      verificationMode: 'verified',
    })
    expect(c1?.evidence[0]).toMatchObject({
      domain: 'sca.coffee',
      qualityScore: 0.95,
      qualitySource: 'evidence-sources',
      href: 'https://sca.coffee/research/x',
    })
  })

  it('takes the novel flags from claimIds rather than re-deriving them', () => {
    expect(view.claims.find((c) => c.id === 'c001')?.materiallyNovel).toBe(true)
    expect(view.claims.find((c) => c.id === 'c001')?.verifiedNovel).toBe(true)
    expect(view.claims.find((c) => c.id === 'c002')?.materiallyNovel).toBe(false)
    expect(view.claims.find((c) => c.id === 'c002')?.requiresHumanReview).toBe(true)
  })

  it('reports the claim count and does not truncate a small run', () => {
    expect(view.claimCount).toBe(2)
    expect(view.claimsTruncated).toBe(false)
  })
})

describe('toRunView — missing and malformed input', () => {
  it('does not throw when scores, claimSummary, claimIds, reasons and claims are absent', () => {
    const view = toRunView(run())
    expect(view.scores.consensusCoverage).toBeNull()
    expect(view.scores.facetGainCoverage).toBeNull()
    expect(view.claimSummary.totalClaims).toBeNull()
    expect(view.reasons).toEqual([])
    expect(view.claims).toEqual([])
    expect(view.claimCount).toBe(0)
    expect(view.claimsTruncated).toBe(false)
    expect(view.calibrated).toBe(false)
    expect(view.baselineAvailable).toBe(false)
  })

  it('nulls non-numeric and non-finite score values rather than passing them through', () => {
    const view = toRunView(
      run({
        scores: {
          consensusCoverage: null,
          verificationRatio: Number.NaN,
          verifiedGainUnits: 'lots',
        },
      } as never),
    )
    expect(view.scores.consensusCoverage).toBeNull()
    expect(view.scores.verificationRatio).toBeNull()
    expect(view.scores.verifiedGainUnits).toBeNull()
  })

  it('falls back to a review decision when the stored decision is not one of the four', () => {
    expect(toRunView(run({ decision: 'MAYBE' } as never)).decision).toBe('HUMAN_REVIEW')
  })

  /**
   * Chosen behaviour for claims that do not match `ClaimRecord`: keep the row,
   * fill each unusable field with its empty value (`''`, `null`, `false`, `[]`)
   * rather than dropping the claim or letting `undefined` reach the page. A
   * reviewer sees a claim with blank cells — visibly incomplete — instead of a
   * claim silently missing from the scorecard.
   */
  it('keeps shape-violating claims as rows of empty values', () => {
    const view = toRunView(
      run({
        claims: [
          null,
          'not an object',
          { id: 'c009' },
          { id: 'c010', novelty: 'high', evidence: 'nope', scored: null, section: 42 },
        ],
      } as never),
    )
    expect(view.claims).toHaveLength(4)
    expect(view.claimCount).toBe(4)
    expect(view.claims[0]).toMatchObject({ id: '', text: '', excerpt: '', evidence: [] })
    expect(view.claims[2]).toMatchObject({ id: 'c009', novelty: null, blocked: false })
    expect(view.claims[3]).toMatchObject({
      id: 'c010',
      novelty: null,
      section: null,
      evidence: [],
      potentialGain: null,
      requiresHumanReview: false,
    })
  })

  it('keeps malformed reasons readable, defaulting policy and severity', () => {
    const view = toRunView(run({ reasons: [{}, { policy: 'X', severity: 'WAT' }] } as never))
    expect(view.reasons[0]).toEqual({
      policy: 'UNKNOWN',
      claimId: undefined,
      message: '',
      severity: 'REVISE',
    })
    expect(view.reasons[1].severity).toBe('REVISE')
  })
})

describe('toRunView — evidence URL safety', () => {
  const evidenceFor = (url: unknown) =>
    toRunView(
      run({ claims: [claim('c1', { evidence: [{ url, domain: 'example.com' }] })] } as never),
    ).claims[0].evidence[0]

  it('keeps http and https URLs', () => {
    expect(evidenceFor('https://example.com/a').href).toBe('https://example.com/a')
    expect(evidenceFor('http://example.com/a').href).toBe('http://example.com/a')
  })

  it('rejects javascript:, data: and other non-http schemes', () => {
    expect(evidenceFor('javascript:alert(1)').href).toBeNull()
    // Scheme comparison is case-insensitive: `new URL` lowercases the protocol.
    expect(evidenceFor('JavaScript:alert(1)').href).toBeNull()
    expect(evidenceFor('data:text/html,<script>alert(1)</script>').href).toBeNull()
    expect(evidenceFor('file:///etc/passwd').href).toBeNull()
  })

  it('rejects unparseable or non-string URLs, falling back to the domain text', () => {
    expect(evidenceFor('not a url').href).toBeNull()
    expect(evidenceFor(undefined).href).toBeNull()
    expect(evidenceFor(42).href).toBeNull()
    expect(evidenceFor('https://example.com/a').domain).toBe('example.com')
  })
})

describe('selectRenderedClaims', () => {
  it('leaves a run at or under the cap untouched and in its own order', () => {
    const claims = Array.from({ length: 5 }, (_, i) => scorecardClaim(`c${i}`))
    const result = selectRenderedClaims(claims, [], 5)
    expect(result.truncated).toBe(false)
    expect(result.claims.map((c) => c.id)).toEqual(['c0', 'c1', 'c2', 'c3', 'c4'])
  })

  it('orders blocked and review-flagged first, then materially novel, then the rest', () => {
    const claims = [
      scorecardClaim('plain'),
      scorecardClaim('novel', { materiallyNovel: true }),
      scorecardClaim('review', { requiresHumanReview: true }),
      scorecardClaim('plain2'),
      scorecardClaim('blocked', { blocked: true }),
    ]
    const result = selectRenderedClaims(claims, [], 4)
    expect(result.claims.map((c) => c.id)).toEqual(['review', 'blocked', 'novel', 'plain'])
    expect(result.truncated).toBe(true)
  })

  it('never drops a claim a policy reason cites, even an unflagged one', () => {
    const claims = [
      scorecardClaim('cited'),
      ...Array.from({ length: 5 }, (_, i) => scorecardClaim(`b${i}`, { blocked: true })),
    ]
    const reasons = [
      {
        policy: 'EVIDENCE_LINEAGE_MISSING' as const,
        claimId: 'cited',
        message: 'Claim cited is materially novel but cites no evidence.',
        severity: 'BLOCK' as const,
      },
    ]
    const result = selectRenderedClaims(claims, reasons, 2)
    expect(result.claims.map((c) => c.id)).toContain('cited')
    expect(result.claims).toHaveLength(2)
  })

  it('keeps every cited claim even when they alone exceed the cap', () => {
    const claims = Array.from({ length: 5 }, (_, i) => scorecardClaim(`c${i}`))
    const reasons = claims.map((c) => ({
      policy: 'FIRST_PARTY_MEASUREMENT_PRESENT' as const,
      claimId: c.id,
      message: `Claim ${c.id} asserts a first-party measurement.`,
      severity: 'BLOCK' as const,
    }))
    const result = selectRenderedClaims(claims, reasons, 2)
    expect(result.claims).toHaveLength(5)
    expect(result.truncated).toBe(false)
  })

  it('ignores document-level reasons, which cite no claim', () => {
    const claims = Array.from({ length: 4 }, (_, i) => scorecardClaim(`c${i}`))
    const reasons = [
      {
        policy: 'COVERAGE_BELOW_MIN' as const,
        message: 'Consensus coverage was 40%; minimum is 60%.',
        severity: 'REVISE' as const,
      },
    ]
    const result = selectRenderedClaims(claims, reasons, 2)
    expect(result.claims.map((c) => c.id)).toEqual(['c0', 'c1'])
    expect(result.truncated).toBe(true)
  })

  it('caps at 60 by default, matching the claim-extraction ceiling', () => {
    expect(MAX_RENDERED_CLAIMS).toBe(60)
    const claims = Array.from({ length: 61 }, (_, i) => scorecardClaim(`c${i}`))
    const result = selectRenderedClaims(claims, [])
    expect(result.claims).toHaveLength(60)
    expect(result.truncated).toBe(true)
  })
})
