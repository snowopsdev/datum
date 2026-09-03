import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decideEvidence,
  decideQualitative,
  type EvidenceClaimFinding,
  evidenceRevisionNotes,
  parseEvidenceCheck,
  parseFactCheck,
  parseQualitative,
} from '../src/qa/verdicts'

test('legacy {passed, notes} shape parses with null voice fields and passes', () => {
  const verdict = parseQualitative({ passed: true, notes: 'Fine.' })
  assert.deepEqual(verdict, {
    passed: true,
    notes: 'Fine.',
    voiceScore: null,
    voiceNotes: null,
    notTraitViolations: [],
  })
  assert.equal(decideQualitative(verdict), true)
})

test('a low voiceScore alone never fails the article', () => {
  const verdict = parseQualitative({
    passed: true,
    notes: 'OK',
    voiceScore: 1,
    voiceNotes: 'Flat and generic.',
    notTraitViolations: [],
  })
  assert.equal(verdict.voiceScore, 1)
  assert.equal(verdict.voiceNotes, 'Flat and generic.')
  assert.equal(decideQualitative(verdict), true)
})

test('voiceScore is clamped to an integer 1–5 and nulled when invalid', () => {
  assert.equal(parseQualitative({ passed: true, notes: '', voiceScore: 9 }).voiceScore, 5)
  assert.equal(parseQualitative({ passed: true, notes: '', voiceScore: 0 }).voiceScore, 1)
  assert.equal(parseQualitative({ passed: true, notes: '', voiceScore: 3.6 }).voiceScore, 4)
  assert.equal(parseQualitative({ passed: true, notes: '', voiceScore: '4' }).voiceScore, null)
})

test('a not-trait violation with an excerpt fails even when passed is true', () => {
  const verdict = parseQualitative({
    passed: true,
    notes: 'Good otherwise.',
    voiceScore: 4,
    notTraitViolations: [
      { trait: 'Sarcastic', excerpt: 'Sure, because that always works.', explanation: 'Mocks the reader.' },
    ],
  })
  assert.equal(verdict.notTraitViolations.length, 1)
  assert.equal(decideQualitative(verdict), false)
})

test('violations without a non-empty excerpt are dropped', () => {
  const verdict = parseQualitative({
    passed: true,
    notes: '',
    notTraitViolations: [
      { trait: 'Sarcastic', explanation: 'Felt sarcastic.' },
      { trait: 'Hype-driven', excerpt: '   ' },
      'garbage',
    ],
  })
  assert.deepEqual(verdict.notTraitViolations, [])
  assert.equal(decideQualitative(verdict), true)
})

test('parsers reject verdicts without the required fields', () => {
  assert.throws(() => parseQualitative({ passed: 'yes', notes: '' }), /qualitativeReview verdict/)
  assert.throws(() => parseFactCheck({ passed: true }), /factCheck verdict/)
  assert.deepEqual(parseFactCheck({ passed: false, notes: 'n', sources: ['a', 1] }), {
    passed: false,
    notes: 'n',
    sources: ['a'],
  })
})

// ---------------------------------------------------------------------------
// Evidence check
// ---------------------------------------------------------------------------

const finding = (over: Partial<EvidenceClaimFinding> = {}): EvidenceClaimFinding => ({
  excerpt: 'We serve 312 teams.',
  kind: 'first_party',
  status: 'unbacked',
  ref: null,
  note: '',
  ...over,
})

const noRefs = { unknown: [] as string[], unusable: [] as { ref: string; reason: string }[] }

test('parseEvidenceCheck drops a finding with no verbatim excerpt', () => {
  const verdict = parseEvidenceCheck({
    claims: [
      { excerpt: '  We serve 312 teams.  ', kind: 'first_party', status: 'unbacked', ref: null, note: 'no entry' },
      { excerpt: '', status: 'rejected' },
      { excerpt: '   ', status: 'rejected' },
      { status: 'rejected', note: 'the article overstates performance somewhere' },
    ],
    notes: 'one unbacked claim',
  })
  assert.equal(verdict.claims.length, 1)
  assert.equal(verdict.claims[0].excerpt, 'We serve 312 teams.', 'the excerpt is trimmed')
  assert.equal(verdict.notes, 'one unbacked claim')
})

test('parseEvidenceCheck drops an unrecognised status rather than guessing one', () => {
  const verdict = parseEvidenceCheck({
    claims: [
      { excerpt: 'A.', status: 'probably_fine' },
      { excerpt: 'B.', status: 'unusable' },
      { excerpt: 'C.', status: 'backed', ref: 'E1' },
    ],
  })
  assert.deepEqual(verdict.claims.map((c) => c.excerpt), ['C.'])
  assert.equal(verdict.claims[0].ref, 'E1')
  assert.equal(verdict.claims[0].kind, 'first_party', 'the kind defaults, the status never does')
})

test('parseEvidenceCheck survives a model that returns nothing useful', () => {
  for (const json of [null, undefined, {}, { claims: 'no' }, 'text']) {
    assert.deepEqual(parseEvidenceCheck(json), { claims: [], notes: '' })
  }
})

test('decideEvidence fails on rejected, overreach, and unusable, and only flags unbacked', () => {
  const table: { status: EvidenceClaimFinding['status']; passes: boolean }[] = [
    { status: 'backed', passes: true },
    { status: 'unbacked', passes: true },
    { status: 'overreach', passes: false },
    { status: 'rejected', passes: false },
  ]
  for (const row of table) {
    const decision = decideEvidence({ claims: [finding({ status: row.status })], notes: '' }, noRefs)
    assert.equal(decision.passed, row.passes, `${row.status} should ${row.passes ? 'pass' : 'fail'}`)
    assert.equal(decision.findings.length, 1, 'every finding is recorded either way')
  }
  assert.equal(decideEvidence({ claims: [], notes: '' }, noRefs).passed, true)
})

test('decideEvidence turns an unknown or unusable ref into a failing finding of its own', () => {
  const decision = decideEvidence(
    { claims: [finding({ status: 'backed', ref: 'E1' })], notes: '' },
    { unknown: ['E9'], unusable: [{ ref: 'E2', reason: 'expired: re-check was due 2026-06-30' }] },
  )
  assert.equal(decision.passed, false)
  assert.deepEqual(decision.findings.map((f) => f.status), ['backed', 'unusable', 'unusable'])
  assert.equal(decision.findings[1].excerpt, '[E9]')
  assert.match(decision.findings[1].note, /No such entry in the evidence bank\./)
  assert.match(decision.findings[2].note, /expired: re-check was due 2026-06-30/)
})

test('evidenceRevisionNotes writes one actionable line per failing finding, worst first', () => {
  const notes = evidenceRevisionNotes([
    finding({ status: 'backed', excerpt: 'Fine.' }),
    finding({ status: 'unbacked', excerpt: 'Flagged only.' }),
    finding({ status: 'overreach', excerpt: 'Fastest at any scale.', ref: 'E1' }),
    finding({ status: 'rejected', excerpt: 'We guarantee rankings.', replacement: 'E4' }),
    finding({ status: 'unusable', excerpt: '[E9]', ref: 'E9' }),
  ])
  assert.deepEqual(notes.split('\n'), [
    'Remove or replace: We guarantee rankings. (rejected, use E4)',
    'Remove or replace: [E9] (unusable)',
    'Remove or replace: Fastest at any scale. (overreach, use [E1] only within its stated limits)',
  ])
  assert.equal(evidenceRevisionNotes([finding({ status: 'backed' })]), '')
})
