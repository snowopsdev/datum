import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  compareValues,
  extractValues,
  hasNumericOrTemporal,
  type ExtractedValue,
  type TextValues,
} from '../src/informationGain/lib'

/** Compact `kind:value unit` rendering so a whole extraction fits one assertion. */
const shape = (text: string): string[] =>
  extractValues(text).values.map(
    (v: ExtractedValue) => `${v.kind}:${v.value}${v.unit === null ? '' : ` ${v.unit}`}`,
  )

const exactness = (claim: string, evidence: string[]): number =>
  compareValues(extractValues(claim), evidence.map(extractValues)).exactness

const mismatches = (claim: string, evidence: string[]): string[] =>
  compareValues(extractValues(claim), evidence.map(extractValues)).mismatches

describe('extractValues — percent', () => {
  it('reads %, "percent", and "per cent" as the same percent value', () => {
    assert.deepEqual(shape('40%'), ['percent:40 %'])
    assert.deepEqual(shape('40 percent'), ['percent:40 %'])
    assert.deepEqual(shape('40 per cent'), ['percent:40 %'])
  })

  it('does not read a bare number as a percent', () => {
    assert.deepEqual(shape('40 widgets'), ['number:40'])
  })
})

describe('extractValues — currency', () => {
  it('reads symbols and codes, before and after the amount', () => {
    assert.deepEqual(shape('$1,500'), ['currency:1500 USD'])
    assert.deepEqual(shape('USD 1500'), ['currency:1500 USD'])
    assert.deepEqual(shape('1500 USD'), ['currency:1500 USD'])
    assert.deepEqual(shape('€20'), ['currency:20 EUR'])
    assert.deepEqual(shape('£5'), ['currency:5 GBP'])
    assert.deepEqual(shape('EUR 20'), ['currency:20 EUR'])
  })

  it('does not invent a currency for a number with no symbol or code', () => {
    assert.deepEqual(shape('1500'), ['number:1500'])
  })
})

describe('extractValues — year and date', () => {
  it('reads a standalone 1900–2099 integer as a year', () => {
    assert.deepEqual(shape('shipped in 2026'), ['year:2026'])
    assert.deepEqual(shape('back in 1999'), ['year:1999'])
  })

  it('does not read a year out of a larger or fractional number', () => {
    assert.deepEqual(shape('12026 rows'), ['number:12026'])
    assert.deepEqual(shape('2026.5'), ['number:2026.5'])
    // 2101 is outside 1900–2099, so it stays a plain number.
    assert.deepEqual(shape('2101'), ['number:2101'])
  })

  it('reads dates in all four shapes as yyyymm, ignoring the day', () => {
    assert.deepEqual(shape('2026-01-05'), ['date:202601'])
    assert.deepEqual(shape('Jan 2026'), ['date:202601'])
    assert.deepEqual(shape('January 5, 2026'), ['date:202601'])
    assert.deepEqual(shape('5 January 2026'), ['date:202601'])
  })

  it('emits only the date, never the date plus its year (no double counting)', () => {
    assert.deepEqual(shape('January 5, 2026'), ['date:202601'])
  })
})

describe('extractValues — numbers, units, multipliers, ranges', () => {
  it('strips thousands separators inside a digit group', () => {
    assert.deepEqual(shape('20,000 news URLs'), ['number:20000'])
  })

  it('applies k/m/bn/thousand/million/billion multipliers', () => {
    assert.deepEqual(shape('20K'), ['number:20000'])
    assert.deepEqual(shape('1.5m'), ['number:1500000'])
    assert.deepEqual(shape('3bn'), ['number:3000000000'])
    assert.deepEqual(shape('1.5 million'), ['number:1500000'])
    assert.deepEqual(shape('4 thousand'), ['number:4000'])
    assert.deepEqual(shape('2 billion'), ['number:2000000000'])
  })

  it('does not treat a unit that merely starts with a multiplier letter as a multiplier', () => {
    assert.deepEqual(shape('5km'), ['number:5 km'])
    assert.deepEqual(shape('5mi'), ['number:5 mi'])
  })

  it('normalises unit tokens to their canonical short form', () => {
    assert.deepEqual(shape('30 seconds'), ['number:30 s'])
    assert.deepEqual(shape('30 minutes'), ['number:30 min'])
    assert.deepEqual(shape('2 hours'), ['number:2 h'])
    assert.deepEqual(shape('500 milliseconds'), ['number:500 ms'])
    assert.deepEqual(shape('3 days'), ['number:3 day'])
    assert.deepEqual(shape('6 weeks'), ['number:6 week'])
    assert.deepEqual(shape('9 months'), ['number:9 month'])
    assert.deepEqual(shape('2 years'), ['number:2 year'])
    assert.deepEqual(shape('12 pounds'), ['number:12 lb'])
    assert.deepEqual(shape('8 ounces'), ['number:8 oz'])
    assert.deepEqual(shape('250 grams'), ['number:250 g'])
    assert.deepEqual(shape('26 miles'), ['number:26 mi'])
  })

  it('leaves a number with no recognised unit unitless', () => {
    assert.deepEqual(shape('7 bananas'), ['number:7'])
  })

  it('expands ranges into two values that share the unit', () => {
    assert.deepEqual(shape('25 to 30 seconds'), ['number:25 s', 'number:30 s'])
    assert.deepEqual(shape('25–30 seconds'), ['number:25 s', 'number:30 s'])
    assert.deepEqual(shape('25-30 s'), ['number:25 s', 'number:30 s'])
  })

  it('parses word numbers when they carry a unit', () => {
    assert.deepEqual(shape('four to six weeks'), ['number:4 week', 'number:6 week'])
    assert.deepEqual(shape('twenty minutes'), ['number:20 min'])
    assert.deepEqual(shape('ninety percent'), ['percent:90 %'])
  })

  it('does not turn prose word numbers into bare values', () => {
    // Bare (unit-less) word numbers are deliberately not extracted: "one of the
    // best ways" is prose, not a measurement, and treating it as the value 1
    // would manufacture exactness mismatches out of ordinary sentences.
    assert.deepEqual(shape('one of the best ways to do this'), [])
  })
})

describe('extractValues — negation, direction, comparative', () => {
  it('flags negation when a negator is present', () => {
    assert.equal(extractValues('this is not recommended').negated, true)
    assert.equal(extractValues("you can't skip this").negated, true)
  })

  it('does not flag negation for an affirmative sentence', () => {
    assert.equal(extractValues('this is recommended').negated, false)
    // "nothing" contains "no" but is not a standalone negator token.
    assert.equal(extractValues('nothing here').negated, false)
  })

  it('reads increase and decrease directions', () => {
    assert.equal(extractValues('latency increased').direction, 'increase')
    assert.equal(extractValues('latency decreased').direction, 'decrease')
    assert.equal(extractValues('costs fell sharply').direction, 'decrease')
    assert.equal(extractValues('throughput grew').direction, 'increase')
  })

  it('lets the first direction word win when both are present', () => {
    assert.equal(extractValues('costs dropped while revenue rose').direction, 'decrease')
    assert.equal(extractValues('revenue rose while costs dropped').direction, 'increase')
  })

  it('leaves direction null when no direction word appears', () => {
    assert.equal(extractValues('the sky is blue').direction, null)
  })

  it('reads comparatives', () => {
    assert.equal(extractValues('more than 40%').comparative, 'more')
    assert.equal(extractValues('fewer than 40 items').comparative, 'less')
    assert.equal(extractValues('exactly 40 items').comparative, 'equal')
    assert.equal(extractValues('40 items').comparative, null)
  })
})

describe('hasNumericOrTemporal', () => {
  it('is true when any value was extracted', () => {
    assert.equal(hasNumericOrTemporal(extractValues('40% faster')), true)
    assert.equal(hasNumericOrTemporal(extractValues('shipped in 2026')), true)
  })

  it('is false when the text carries no value', () => {
    assert.equal(hasNumericOrTemporal(extractValues('it is generally a good idea')), false)
  })
})

describe('compareValues', () => {
  it('scores 1 when there is nothing comparable', () => {
    assert.equal(exactness('it is a good idea', ['anything at all']), 1)
    assert.equal(exactness('it is a good idea', []), 1)
  })

  it('scores 0 when the claim carries values and there is no evidence at all', () => {
    assert.equal(exactness('40% faster', []), 0)
  })

  it('matches identical percents and mismatches different ones', () => {
    assert.equal(exactness('40 percent of teams', ['40% of teams']), 1)
    assert.equal(exactness('2% of teams', ['20% of teams']), 0)
    assert.deepEqual(mismatches('2% of teams', ['20% of teams']), [
      '2% (percent) not found in evidence',
    ])
  })

  it('matches a currency amount across symbol and code spellings', () => {
    assert.equal(exactness('costs $1,500', ['priced at USD 1500']), 1)
  })

  it('does not convert units: 380 ms and 0.38 s are a mismatch', () => {
    // Deliberate: the gate compares values as written. A model that silently
    // rescaled units could turn a wrong number into a passing one.
    assert.equal(exactness('takes 380 ms', ['takes 0.38 s']), 0)
    assert.deepEqual(mismatches('takes 380 ms', ['takes 0.38 s']), [
      '380 ms (number) not found in evidence',
    ])
    assert.equal(exactness('takes 380 ms', ['takes 380 ms']), 1)
  })

  it('does not match across kinds', () => {
    // 2026 as a year is not the number 2026.
    assert.equal(exactness('shipped in 2026', ['2026 rows were affected']), 1)
    assert.equal(exactness('shipped in 2026', ['shipped in 2025']), 0)
  })

  it('requires units to match when both sides carry one', () => {
    assert.equal(exactness('30 minutes', ['30 seconds']), 0)
    assert.equal(exactness('30 minutes', ['30 mins']), 1)
  })

  it('flags an opposite direction, and accepts a matching one', () => {
    assert.deepEqual(mismatches('latency decreased', ['latency increased']), [
      'direction: claim says decrease, evidence says increase',
    ])
    assert.deepEqual(mismatches('latency decreased', ['latency dropped']), [])
    // No direction in the evidence at all is not a mismatch.
    assert.deepEqual(mismatches('latency decreased', ['latency was measured']), [])
  })

  it('counts the direction check toward exactness', () => {
    assert.equal(exactness('latency decreased', ['latency increased']), 0)
    assert.equal(exactness('latency decreased', ['latency dropped']), 1)
  })

  it('flags a negated claim whose evidence is not negated', () => {
    assert.deepEqual(mismatches('this is not recommended', ['this is recommended']), [
      'negation: claim is negated, evidence is not',
    ])
    assert.deepEqual(mismatches('this is not recommended', ['this is not recommended']), [])
  })

  it('averages the value, direction, and negation checks', () => {
    // One value (matched), one direction (mismatched) → 1/2.
    const claim: TextValues = extractValues('latency decreased by 40%')
    const result = compareValues(claim, [extractValues('latency increased by 40%')])
    assert.equal(result.exactness, 0.5)
    assert.deepEqual(result.mismatches, [
      'direction: claim says decrease, evidence says increase',
    ])
  })

  it('matches a value found in any one of several evidence excerpts', () => {
    assert.equal(exactness('40% faster', ['unrelated text', '40% faster in tests']), 1)
  })
})
