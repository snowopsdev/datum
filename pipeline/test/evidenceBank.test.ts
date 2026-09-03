import assert from 'node:assert/strict'
import test from 'node:test'

import { EVIDENCE_BANK_FIXTURE } from '../../cms/src/lib/tenant/fixtures'
import {
  checkEvidenceRefs,
  type EvidenceBankContent,
  evidenceBankContentOf,
  evidenceBankSummary,
  evidenceBankToPrompt,
  evidenceRefsIn,
  evidenceRules,
  expiredClaims,
  isEvidenceBankEmpty,
  MAX_PROMPT_CLAIMS,
  neverUseClaims,
  nextRef,
  parseEvidenceBankContent,
  stripEvidenceRefs,
  usableClaims,
  type VerifiedClaim,
} from '../src/tenant'

const claim = (over: Partial<VerifiedClaim> & { ref: string }): VerifiedClaim => ({
  claim: 'Something measurable happened',
  primarySource: '',
  sourceUrl: '',
  sourceDate: '',
  sampleOrMethod: '',
  verificationDepth: '',
  limits: '',
  clearedSurfaces: [],
  recheckAt: '',
  ...over,
})

const bank = (over: Partial<EvidenceBankContent> = {}): EvidenceBankContent => ({
  verifiedClaims: [],
  facts: [],
  rejectedClaims: [],
  ...over,
})

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

test('parseEvidenceBankContent normalises a Payload document and reports what it dropped', () => {
  const { content, warnings } = parseEvidenceBankContent({
    verifiedClaims: [
      {
        ref: '[e1]',
        claim: '  Median latency is 38 ms  ',
        primarySource: 'Benchmark report',
        sourceDate: '2026-05-14T00:00:00.000Z',
        verificationDepth: 'primary_document',
        clearedSurfaces: ['blog', 'web', 'not-a-surface'],
        recheckAt: '2027-01-01T12:00:00.000Z',
      },
      // No ref: nothing could cite it, so it cannot be sent to a writer.
      { claim: 'Unassigned claim', primarySource: 'somewhere' },
    ],
    facts: [{ ref: 'F2', fact: 'Founded in 2021', lastConfirmedAt: 'not a date' }],
    rejectedClaims: [{ ref: 'R3', claim: 'The fastest', status: 'nonsense', reason: 'unverifiable' }],
    notes: 'never parsed',
  })

  assert.equal(content.verifiedClaims.length, 1)
  const [first] = content.verifiedClaims
  assert.equal(first.ref, 'E1', 'refs are upper-cased and unbracketed')
  assert.equal(first.claim, 'Median latency is 38 ms')
  assert.equal(first.sourceDate, '2026-05-14', 'a timestamp is truncated to a day')
  assert.equal(first.recheckAt, '2027-01-01')
  assert.deepEqual(first.clearedSurfaces, ['web', 'blog'], 'unknown surfaces dropped, order fixed')
  assert.equal(content.facts[0].lastConfirmedAt, '', 'an unparseable date becomes empty')
  assert.equal(content.rejectedClaims[0].status, 'rejected', 'an unknown status falls back')
  assert.ok(warnings.some((w) => /verified claim/.test(w)))
  assert.equal('notes' in content, false, 'operator notes never reach the content type')
})

test('evidenceBankContentOf never throws on garbage, and isEvidenceBankEmpty agrees', () => {
  for (const input of [null, undefined, 'text', 42, [], { verifiedClaims: 'no' }]) {
    const content = evidenceBankContentOf(input)
    assert.deepEqual(content, bank())
    assert.equal(isEvidenceBankEmpty(content), true)
  }
  assert.equal(isEvidenceBankEmpty(null), true)
  assert.equal(isEvidenceBankEmpty(bank({ facts: [{ ref: 'F1', fact: 'x', source: '', owner: '', lastConfirmedAt: '' }] })), false)
})

// ---------------------------------------------------------------------------
// Expiry and surfaces
// ---------------------------------------------------------------------------

const dated = bank({
  verifiedClaims: [
    claim({ ref: 'E1', recheckAt: '2026-12-31' }),
    claim({ ref: 'E2', recheckAt: '2026-06-30' }),
    claim({ ref: 'E3', recheckAt: '' }),
  ],
})

test('a claim is expired only once asOf has passed its recheck date', () => {
  assert.deepEqual(
    usableClaims(dated, { asOf: '2026-09-02', surface: 'web' }).map((c) => c.ref),
    ['E1', 'E3'],
  )
  assert.deepEqual(expiredClaims(dated, '2026-09-02').map((c) => c.ref), ['E2'])
  // The re-check date itself is still usable: the claim expires the day after.
  assert.deepEqual(expiredClaims(dated, '2026-06-30'), [])
  assert.deepEqual(expiredClaims(dated, '2026-07-01').map((c) => c.ref), ['E2'])
  // A claim with no re-check date never expires.
  assert.deepEqual(expiredClaims(dated, '2099-01-01').map((c) => c.ref), ['E1', 'E2'])
})

test('an empty clearedSurfaces list means cleared everywhere', () => {
  const surfaced = bank({
    verifiedClaims: [
      claim({ ref: 'E1', clearedSurfaces: [] }),
      claim({ ref: 'E2', clearedSurfaces: ['web'] }),
      claim({ ref: 'E3', clearedSurfaces: ['ads', 'sales'] }),
    ],
  })
  assert.deepEqual(
    usableClaims(surfaced, { asOf: '2026-09-02', surface: 'web' }).map((c) => c.ref),
    ['E1', 'E2'],
  )
  assert.deepEqual(
    usableClaims(surfaced, { asOf: '2026-09-02', surface: 'ads' }).map((c) => c.ref),
    ['E1', 'E3'],
  )
  assert.deepEqual(usableClaims(null, { asOf: '2026-09-02', surface: 'web' }), [])
})

test('neverUseClaims unions the rejected rows with the claims that have gone stale', () => {
  const mixed = bank({
    verifiedClaims: [claim({ ref: 'E1', claim: '99.99% uptime', recheckAt: '2026-06-30' })],
    rejectedClaims: [
      { ref: 'R2', claim: 'Fastest on the market', status: 'rejected', reason: 'unverifiable superlative', replacement: 'E1' },
    ],
  })
  const rows = neverUseClaims(mixed, '2026-09-02')
  assert.deepEqual(rows.map((r) => r.ref), ['R2', 'E1'])
  assert.equal(rows[0].reason, 'rejected: unverifiable superlative')
  assert.equal(rows[0].replacement, 'E1')
  assert.match(rows[1].reason, /^expired: re-check was due 2026-06-30; do not use until re-verified$/)
  // Before the date, the verified claim is not in the list at all.
  assert.deepEqual(neverUseClaims(mixed, '2026-01-01').map((r) => r.ref), ['R2'])
})

test('evidenceBankSummary counts what the hub and readiness report', () => {
  const counted = bank({
    verifiedClaims: [claim({ ref: 'E1' }), claim({ ref: 'E2', recheckAt: '2026-01-01' })],
    facts: [{ ref: 'F3', fact: 'Founded 2021', source: '', owner: '', lastConfirmedAt: '' }],
    rejectedClaims: [{ ref: 'R4', claim: 'x', status: 'rejected', reason: '', replacement: '' }],
  })
  assert.deepEqual(evidenceBankSummary(counted, '2026-09-02'), {
    verified: 2,
    usable: 1,
    expired: 1,
    facts: 1,
    rejected: 1,
  })
  assert.deepEqual(evidenceBankSummary(null, '2026-09-02'), {
    verified: 0,
    usable: 0,
    expired: 0,
    facts: 0,
    rejected: 0,
  })
})

// ---------------------------------------------------------------------------
// Refs in generated text
// ---------------------------------------------------------------------------

test('evidenceRefsIn finds every marker once, in order, wherever it sits', () => {
  assert.deepEqual(evidenceRefsIn('Latency is 38 ms [E3]. Uptime held [E3] and [F2].'), ['E3', 'F2'])
  assert.deepEqual(evidenceRefsIn('## How fast is it [E1]'), ['E1'], 'headings count')
  assert.deepEqual(evidenceRefsIn('A: We measure it hourly [R7].'), ['R7'], 'FAQ answers count')
  assert.deepEqual(evidenceRefsIn(''), [])
  assert.deepEqual(evidenceRefsIn(null), [])
  assert.deepEqual(evidenceRefsIn('No refs here [1] [note] [EE3] [E].'), [])
})

test('stripEvidenceRefs removes the marker and its leading space, and nothing else', () => {
  assert.equal(stripEvidenceRefs('Latency is 38 ms [E3].'), 'Latency is 38 ms.')
  assert.equal(stripEvidenceRefs('Both hold [E1][F2] today.'), 'Both hold today.')
  assert.equal(
    stripEvidenceRefs('See the [docs](https://example.com) and [sic] and array[0].'),
    'See the [docs](https://example.com) and [sic] and array[0].',
    'other bracketed text is untouched',
  )
  assert.equal(stripEvidenceRefs('## Speed [E1]'), '## Speed')
})

test('checkEvidenceRefs separates usable, unknown, and unusable refs', () => {
  const checked = bank({
    verifiedClaims: [claim({ ref: 'E1' }), claim({ ref: 'E2', recheckAt: '2026-06-30' })],
    facts: [{ ref: 'F3', fact: 'Founded 2021', source: '', owner: '', lastConfirmedAt: '' }],
    rejectedClaims: [{ ref: 'R4', claim: 'x', status: 'rejected', reason: 'unverifiable', replacement: '' }],
  })
  const result = checkEvidenceRefs(['E1', 'F3', 'E2', 'R4', 'E9'], checked, '2026-09-02')
  assert.deepEqual(result.ok, ['E1', 'F3'])
  assert.deepEqual(result.unknown, ['E9'])
  assert.deepEqual(result.unusable, [
    { ref: 'E2', reason: 'expired: re-check was due 2026-06-30' },
    { ref: 'R4', reason: 'rejected: unverifiable' },
  ])
  // With no bank at all, every declared ref is a hallucinated citation.
  assert.deepEqual(checkEvidenceRefs(['E1'], null, '2026-09-02').unknown, ['E1'])
})

// ---------------------------------------------------------------------------
// The prompt block
// ---------------------------------------------------------------------------

test('evidenceBankToPrompt returns null for a bank nobody has filled', () => {
  assert.equal(evidenceBankToPrompt(bank(), { asOf: '2026-09-02', surface: 'web' }), null)
  assert.equal(evidenceBankToPrompt(null, { asOf: '2026-09-02', surface: 'web' }), null)
})

test('evidenceBankToPrompt renders claims, facts, and the never-use list', () => {
  const rendered = evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, {
    asOf: '2026-09-02',
    surface: 'web',
    companyName: 'Datum',
  })
  assert.ok(rendered)
  assert.match(rendered, /^# Evidence bank \(the only first-party facts you may state about Datum\)\n/)
  assert.match(rendered, /Cite the ref after the sentence that uses it\. Stay within "Limits"\./)
  assert.match(rendered, /- \[E1\] A reviewer approves the brief[^\n]*Source: Datum pipeline audit export, 2026-08-01\./)
  assert.match(rendered, /Limits: Describes the product/)
  assert.match(rendered, /Cleared: web, blog\./)
  assert.match(rendered, /- \[F4\] .*\(fact; owner: engineering; confirmed 2026-08-20\)/)
  assert.match(rendered, /## Never state these\n- \[R6\] "Datum guarantees your articles will rank" — rejected: .*\. Say instead: \[E1\]\./)
  // E2 is cleared everywhere, so it reaches a `web` prompt.
  assert.match(rendered, /\[E2\]/)
  // Two renders of an unchanged bank are byte-identical: cost-log request
  // snapshots have to explain each other.
  assert.equal(
    rendered,
    evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, { asOf: '2026-09-02', surface: 'web', companyName: 'Datum' }),
  )
})

test('the block drops a claim that is not cleared for the surface, and expires one by date', () => {
  const rendered = evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, {
    asOf: '2026-09-02',
    surface: 'ads',
    companyName: 'Datum',
  })
  assert.ok(rendered)
  assert.ok(
    !/^- \[E1\]/m.test(rendered),
    'E1 is cleared for web and blog only, so it is not offered on an ads prompt',
  )
  // It still appears as R6's replacement, which is correct: the row says what to
  // say instead, and that entry's own clearance is judged where it is used.
  assert.match(rendered, /Say instead: \[E1\]\./)
  assert.match(rendered, /^- \[E2\]/m, 'E2 has no restriction')

  const later = evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, {
    asOf: '2027-04-01',
    surface: 'web',
    companyName: 'Datum',
  })
  assert.ok(later)
  assert.match(later, /## Never state these[\s\S]*\[E3\] .* — expired: re-check was due 2027-01-31/)
  assert.match(later, /\[E2\] .* — expired: re-check was due 2027-03-31/)
})

test('usable claims are capped newest-first, and facts and never-use rows are not', () => {
  const many = bank({
    verifiedClaims: Array.from({ length: MAX_PROMPT_CLAIMS + 5 }, (_, index) =>
      claim({
        ref: `E${index + 1}`,
        claim: `Claim number ${index + 1}`,
        // Ascending dates, so the highest-numbered claims are the newest.
        recheckAt: `2027-${String((index % 12) + 1).padStart(2, '0')}-01`,
      }),
    ),
    facts: Array.from({ length: 3 }, (_, index) => ({
      ref: `F${index + 100}`,
      fact: `Fact ${index}`,
      source: '',
      owner: '',
      lastConfirmedAt: '',
    })),
    rejectedClaims: Array.from({ length: 3 }, (_, index) => ({
      ref: `R${index + 200}`,
      claim: `Rejected ${index}`,
      status: 'rejected' as const,
      reason: 'no',
      replacement: '',
    })),
  })
  const rendered = evidenceBankToPrompt(many, { asOf: '2026-01-01', surface: 'web' })!
  const claimLines = rendered.split('\n').filter((line) => /^- \[E\d+\]/.test(line))
  assert.equal(claimLines.length, MAX_PROMPT_CLAIMS)
  const dates = claimLines.map((line) => {
    const ref = /^- \[(E\d+)\]/.exec(line)![1]
    return many.verifiedClaims.find((c) => c.ref === ref)!.recheckAt
  })
  assert.deepEqual([...dates].sort().reverse(), dates, 'newest recheck date first')
  assert.equal(rendered.split('\n').filter((line) => /^- \[F\d+\]/.test(line)).length, 3)
  assert.equal(rendered.split('\n').filter((line) => /^- \[R\d+\]/.test(line)).length, 3)

  // The QA call asks for the whole bank, and gets it.
  const uncapped = evidenceBankToPrompt(many, { asOf: '2026-01-01', surface: 'web', cap: Infinity })!
  assert.equal(
    uncapped.split('\n').filter((line) => /^- \[E\d+\]/.test(line)).length,
    MAX_PROMPT_CLAIMS + 5,
  )
})

test('a claim with no re-check date sorts after the dated ones', () => {
  const undated = bank({
    verifiedClaims: [
      claim({ ref: 'E1', recheckAt: '' }),
      claim({ ref: 'E2', recheckAt: '2027-01-01' }),
    ],
  })
  const rendered = evidenceBankToPrompt(undated, { asOf: '2026-01-01', surface: 'web' })!
  assert.ok(rendered.indexOf('[E2]') < rendered.indexOf('[E1]'))
})

// ---------------------------------------------------------------------------
// Evidence rules
// ---------------------------------------------------------------------------

test('evidenceRules points the writer at the bank when there is one', () => {
  const rules = evidenceRules('Datum', true)
  assert.match(rules, /Do not invent unique insights\./)
  assert.match(
    rules,
    /First-party facts — anything about Datum, its product, customers, results, pricing, or measurements — may be stated only when they appear in the Evidence bank below\./,
  )
  assert.match(rules, /Put the entry's ref in square brackets at the end of the sentence/)
  assert.match(rules, /Never state anything in "Never state these", even paraphrased/)
  assert.match(rules, /Every number, date, and percentage must be one you can attribute\./)
  assert.ok(!/Datum has none/.test(rules), 'the old hard-coded sentence is gone')
})

test('evidenceRules forbids first-party facts outright when there is no bank', () => {
  const rules = evidenceRules('Datum', false)
  assert.match(rules, /may not be stated at all: this workspace has no evidence bank/)
  assert.ok(!/Never state these/.test(rules), 'there is no such list to point at')
  assert.ok(!/square brackets/.test(rules), 'and no ref to cite')
  // A workspace that has not named itself still gets a readable rule.
  assert.match(evidenceRules('', false), /anything about this company/)
})

test('nextRef formats a counter into a ref', () => {
  assert.equal(nextRef('E', 1), 'E1')
  assert.equal(nextRef('F', 12), 'F12')
  assert.equal(nextRef('R', 300), 'R300')
})
