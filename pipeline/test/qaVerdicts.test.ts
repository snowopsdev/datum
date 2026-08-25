import assert from 'node:assert/strict'
import test from 'node:test'

import { decideQualitative, parseFactCheck, parseQualitative } from '../src/qa/verdicts'

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
