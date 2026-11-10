import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  compareValues,
  extractValues,
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

/** The message for a figure that only ever appears in a contradicting excerpt. */
const contradicted = (raw: string, kind: string): string =>
  `${raw} (${kind}) appears only in evidence that contradicts the claim's negation, direction, or comparative`

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

  // Word numbers are whole words. Without the boundary, the plural `s` and the
  // `h` of an ordinal read as the units seconds and hours.
  it('does not read a word number out of the middle of a word', () => {
    assert.deepEqual(shape('tens of thousands of visitors'), [])
    assert.deepEqual(shape('hundreds of cafes use it'), [])
    assert.deepEqual(shape('ones and zeros'), [])
    assert.deepEqual(shape('the eighth edition'), [])
    assert.equal(exactness('Hundreds of cafes use it', ['Many cafes use it']), 1)
  })

  it('reads a decade as its year, not as seconds', () => {
    assert.deepEqual(shape('popular in the 1990s'), ['year:1990'])
    // A real duration keeps its unit.
    assert.deepEqual(shape('pulled in 30s'), ['number:30 s'])
  })

  it('does not turn prose word numbers into bare values', () => {
    // Bare (unit-less) word numbers are deliberately not extracted: "one of the
    // best ways" is prose, not a measurement, and treating it as the value 1
    // would manufacture exactness mismatches out of ordinary sentences.
    assert.deepEqual(shape('one of the best ways to do this'), [])
  })
})

describe('extractValues — signs', () => {
  it('keeps a leading minus on numbers, percents, and currency', () => {
    assert.deepEqual(shape('growth was -10%'), ['percent:-10 %'])
    assert.deepEqual(shape('a -3 point drop'), ['number:-3'])
    assert.deepEqual(shape('a loss of -1.5m'), ['number:-1500000'])
    assert.deepEqual(shape('costs -$1,500'), ['currency:-1500 USD'])
    assert.deepEqual(shape('costs $-1,500'), ['currency:-1500 USD'])
    assert.deepEqual(shape('usd -1500 written off'), ['currency:-1500 USD'])
  })

  it('reads the U+2212 minus sign as a minus, and keeps the sign in raw', () => {
    assert.deepEqual(shape('growth was \u221210%'), ['percent:-10 %'])
    assert.deepEqual(
      extractValues('growth was -10%').values.map((v: ExtractedValue) => v.raw),
      ['-10%'],
    )
    assert.deepEqual(
      extractValues('growth was \u221210%').values.map((v: ExtractedValue) => v.raw),
      ['\u221210%'],
    )
  })

  it('keeps a leading plus in raw but reads it as the positive value', () => {
    // `+10%` and `10%` are the same figure written two ways; only a minus flips
    // the value, so a written-out plus must not become a separate value.
    assert.deepEqual(shape('growth was +10%'), ['percent:10 %'])
    assert.deepEqual(
      extractValues('growth was +10%').values.map((v: ExtractedValue) => v.raw),
      ['+10%'],
    )
    assert.equal(exactness('growth was +10%', ['growth was 10%']), 1)
  })

  it('signs both bounds of a negative range', () => {
    assert.deepEqual(shape('-10 to -5 seconds'), ['number:-10 s', 'number:-5 s'])
    assert.deepEqual(
      extractValues('-10 to -5 seconds').values.map((v: ExtractedValue) => v.raw),
      ['-10 s', '-5 s'],
    )
  })

  it('treats a hyphen between two amounts as a range separator, never a sign', () => {
    // The disambiguation rule: a sign has to *open* a token. In `5-10` the
    // hyphen sits right after a digit, so both bounds stay positive.
    assert.deepEqual(shape('5-10 seconds'), ['number:5 s', 'number:10 s'])
    assert.deepEqual(shape('5-10'), ['number:5', 'number:10'])
  })

  it('does not sign a number that follows a word character', () => {
    assert.deepEqual(shape('top-10 list'), ['number:10'])
    assert.deepEqual(shape('Q3-2026 revenue'), ['number:3', 'year:2026'])
  })

  it('leaves dates and years unsigned, and demotes a signed four-digit token', () => {
    assert.deepEqual(shape('shipped 2026-01-05'), ['date:202601'])
    assert.deepEqual(shape('shipped in 2026'), ['year:2026'])
    // A sign means it is an amount, not a year.
    assert.deepEqual(shape('a -2026 adjustment'), ['number:-2026'])
  })

  it('does not let evidence of the opposite sign support a signed claim', () => {
    // The reviewer's case: before signs were captured, `-10%` extracted as 10
    // and `growth was 10%` scored exactness 1 against `growth was -10%`.
    assert.ok(exactness('growth was -10%', ['growth was 10%']) < 1)
    assert.deepEqual(mismatches('growth was -10%', ['growth was 10%']), [
      '-10% (percent) not found in evidence',
    ])
    assert.equal(exactness('growth was -10%', ['growth was -10%']), 1)
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

  // `2000` alone is classified as a year and `2,000` as a number. They are the
  // same figure, and a correctly sourced count must not score 0 on punctuation.
  it('matches a four-digit count written with and without a comma', () => {
    assert.equal(exactness('enrolled 2000 participants', ['enrolled 2,000 participants']), 1)
    assert.equal(exactness('enrolled 2,000 participants', ['enrolled 2000 participants']), 1)
    assert.equal(exactness('enrolled 2000 participants', ['enrolled 2,001 participants']), 0)
    // A number with a unit is still not a year.
    assert.equal(exactness('shipped in 2026', ['took 2026 ms']), 0)
    // Only the spelling difference counts: a multiplier or a decimal is another figure.
    assert.equal(exactness('founded in 2000', ['2k users']), 0)
    assert.equal(exactness('founded in 2000', ['2 thousand users']), 0)
    assert.equal(exactness('founded in 2000', ['2000.0 users']), 0)
    // Nor is a decade a count: only a year written as four bare digits matches.
    assert.equal(exactness('popular in the 2000s', ['2,000 stores']), 0)
    assert.equal(exactness('popular in the 1990s', ['1,990 cafes']), 0)
    assert.equal(exactness('popular in the 1990s', ['big in the 1990s']), 1)
  })

  // A decade is not the single year of the same number either, in either
  // direction, however the other side is written.
  it('matches a decade only against a decade', () => {
    assert.equal(exactness('launched in 2000', ['launched in the 2000s']), 0)
    assert.equal(exactness('launched in the 2000s', ['launched in 2000']), 0)
    assert.equal(exactness('popular in the 2000s', ['2000 stores']), 0)
    assert.equal(exactness('popular in the 1990s', ['1990 cafes']), 0)
  })

  // Extraction ignores case, so the decade test has to as well: an all-caps
  // heading is still a decade, and still not the single year.
  it('recognises a decade whatever its case', () => {
    assert.deepEqual(shape('THE 1990S'), ['year:1990'])
    assert.equal(exactness('popular in the 1990s', ['THE 1990S']), 1)
    assert.equal(exactness('POPULAR IN THE 1990S', ['popular in the 1990s']), 1)
    assert.equal(exactness('launched in 1990', ['THE 1990S']), 0)
    assert.equal(exactness('THE 1990S', ['launched in 1990']), 0)
    assert.equal(exactness('THE 2000S', ['2,000 stores']), 0)
  })

  // Only the full form is a decade: the short second half keeps reading as seconds.
  it('reads only a four-digit decade as one', () => {
    assert.deepEqual(shape('the 1920s-30s'), ['year:1920', 'number:30 s'])
  })

  // `2020's` is as often a possessive as a decade, so it stays the plain year
  // it has always been and keeps matching that year.
  it('leaves a possessive year a year', () => {
    assert.equal(
      exactness("During 2020's lockdowns, sales rose 30%", ['In 2020, sales rose 30%']),
      1,
    )
    assert.equal(
      exactness('In 2020, sales rose 30%', ["During 2020's lockdowns, sales rose 30%"]),
      1,
    )
    assert.equal(exactness("2010's biggest launch", ['the biggest launch of 2010']), 1)
  })

  // The two costs these rules accept, pinned so a change to either is a decision.
  it('accepts that a bare year and a plain count of the same value are one figure', () => {
    assert.equal(exactness('founded in 2000', ['2,000 customers']), 1)
    assert.equal(exactness('1,990 cafes', ['founded 1990']), 1)
    // A leading zero is not how a count is written.
    assert.equal(exactness('founded in 2000', ['02000 participants']), 0)
  })

  it('accepts that a duration written like a decade reads as one', () => {
    assert.deepEqual(shape('a timeout of 2000s'), ['year:2000'])
    assert.equal(exactness('a timeout of 2000s', ['2000 s']), 0)
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

  it('costs a contradicting excerpt both the value and the qualifier point', () => {
    // The only excerpt quoting 40% states the opposite direction, so it anchors
    // nothing: the value and the direction both count as unmatched → 0/2.
    const claim: TextValues = extractValues('latency decreased by 40%')
    const result = compareValues(claim, [extractValues('latency increased by 40%')])
    assert.equal(result.exactness, 0)
    assert.deepEqual(result.mismatches, [
      contradicted('40%', 'percent'),
      'direction: claim says decrease, evidence says increase',
    ])
  })

  it('matches a value found in any one of several evidence excerpts', () => {
    assert.equal(exactness('40% faster', ['unrelated text', '40% faster in tests']), 1)
  })
})

describe('compareValues — symmetric negation', () => {
  it('flags an affirmative claim whose evidence is negated', () => {
    // The reviewer's case: the numbers agree, the propositions are opposites.
    // Before the symmetric check this scored 1 and satisfied requireExactValueMatch.
    assert.deepEqual(mismatches('80% recommend it', ['80% do not recommend it']), [
      contradicted('80%', 'percent'),
      'negation: claim is affirmative, evidence is negated',
    ])
    // The negated excerpt is the only one quoting 80%, so it anchors neither the
    // value nor the negation → 0/2, and crucially < 1.
    assert.equal(exactness('80% recommend it', ['80% do not recommend it']), 0)
  })

  it('flags the mirror case, a negated claim against affirmative evidence', () => {
    assert.deepEqual(mismatches('80% do not recommend it', ['80% recommend it']), [
      contradicted('80%', 'percent'),
      'negation: claim is negated, evidence is not',
    ])
    assert.equal(exactness('80% do not recommend it', ['80% recommend it']), 0)
  })

  it('accepts evidence whose negation matches the claim, either way round', () => {
    assert.equal(exactness('80% recommend it', ['80% recommend it']), 1)
    assert.equal(exactness('80% do not recommend it', ['80% do not recommend it']), 1)
  })

  it('accepts an affirmative claim when any one excerpt is affirmative too', () => {
    assert.equal(exactness('80% recommend it', ['80% do not recommend it', '80% recommend it']), 1)
  })

  it('does not open a negation comparable when neither side is negated', () => {
    // Nothing comparable at all, so the claim still scores 1.
    assert.equal(exactness('this is recommended', ['this is recommended']), 1)
  })
})

describe('compareValues — comparative polarity', () => {
  it('does not let a bare figure satisfy a "more than" threshold', () => {
    // The reviewer's case: `more than 10%` was fully matched by evidence saying
    // exactly `10%`, because the extracted comparative was never compared.
    assert.ok(exactness('more than 10% of teams', ['10% of teams']) < 1)
    assert.deepEqual(mismatches('more than 10% of teams', ['10% of teams']), [
      contradicted('10%', 'percent'),
      'comparative: claim asserts more than the stated value, evidence does not',
    ])
  })

  it('accepts evidence asserting the same threshold', () => {
    assert.equal(exactness('more than 10% of teams', ['more than 10% of teams']), 1)
    assert.equal(exactness('fewer than 10 items', ['fewer than 10 items']), 1)
  })

  it('flags an opposing threshold', () => {
    // "less"/"more" are direction words too, so this excerpt trips both checks.
    assert.deepEqual(mismatches('less than 10 items', ['more than 10 items']), [
      contradicted('10', 'number'),
      'direction: claim says decrease, evidence says increase',
      'comparative: claim asserts less than the stated value, evidence does not',
    ])
  })

  it('lets a bare figure support an "exactly" claim', () => {
    // `equal` is what a bare figure already asserts, so evidence with no
    // comparative of its own supports it.
    assert.equal(exactness('exactly 40 items', ['40 items']), 1)
    assert.equal(exactness('exactly 40 items', ['exactly 40 items']), 1)
  })

  it('flags an "exactly" claim whose evidence states a threshold instead', () => {
    assert.deepEqual(mismatches('exactly 40 items', ['more than 40 items']), [
      contradicted('40', 'number'),
      'comparative: claim asserts exactly the stated value, evidence does not',
    ])
    assert.equal(exactness('exactly 40 items', ['more than 40 items']), 0)
  })

  it('leaves a claim with no comparative unaffected by one in the evidence', () => {
    assert.equal(exactness('40 items', ['more than 40 items']), 1)
  })
})

describe('compareValues — one excerpt must carry both value and polarity', () => {
  it("does not let a second excerpt lend its polarity to another excerpt's figure", () => {
    // The reviewer's case: the negated excerpt supplies the number and the
    // value-less one supplies the affirmative polarity. Pooled, that scored 1.
    const evidence = ['80% do not recommend it', 'Experts recommend it']
    assert.equal(exactness('80% recommend it', evidence), 0)
    assert.deepEqual(mismatches('80% recommend it', evidence), [
      contradicted('80%', 'percent'),
      'negation: claim is affirmative, evidence is negated',
    ])
  })

  it('accepts one excerpt that legitimately carries the figure and the polarity', () => {
    const evidence = ['80% do not recommend it', '80% of respondents recommend it']
    assert.equal(exactness('80% recommend it', evidence), 1)
    assert.deepEqual(mismatches('80% recommend it', evidence), [])
  })

  it('does not let a value-less excerpt satisfy the direction check either', () => {
    // `latency dropped` agrees with the claim's direction but never mentions
    // 40%, so it cannot anchor anything the claim asserts about that figure.
    const evidence = ['latency increased by 40%', 'latency dropped']
    assert.equal(exactness('latency decreased by 40%', evidence), 0)
    assert.deepEqual(mismatches('latency decreased by 40%', evidence), [
      contradicted('40%', 'percent'),
      'direction: claim says decrease, evidence says increase',
    ])
  })

  it('reports the qualifier as unanchored when no excerpt carries the figure', () => {
    assert.equal(exactness('latency decreased by 40%', ['latency dropped']), 0)
    assert.deepEqual(mismatches('latency decreased by 40%', ['latency dropped']), [
      '40% (percent) not found in evidence',
      "direction: claim says decrease, no evidence excerpt carries the claim's values",
    ])
  })

  it('leaves a claim with qualifiers but no values judged against every excerpt', () => {
    // Nothing to anchor to — and nothing to assemble either, since the attack
    // needs a figure to borrow — so these read exactly as they did before.
    assert.equal(exactness('latency decreased', ['latency was measured']), 1)
    assert.equal(exactness('latency decreased', ['latency dropped', 'unrelated']), 1)
    assert.equal(exactness('latency decreased', ['latency increased']), 0)
    assert.equal(exactness('this is not recommended', ['this is not recommended']), 1)
  })
})

describe('extractValues — compound word numbers', () => {
  it('reads a round ten joined to a unit as one amount', () => {
    assert.deepEqual(shape('twenty-five percent'), ['percent:25 %'])
    assert.deepEqual(shape('twenty five percent'), ['percent:25 %'])
    assert.deepEqual(shape('ninety-nine percent'), ['percent:99 %'])
    assert.deepEqual(shape('$twenty-five'), ['currency:25 USD'])
    assert.deepEqual(shape('fifty-five percent'), ['percent:55 %'])
  })

  // Without the guard the regex backtracks to `twenty` and reads a range.
  it('does not split a compound into a range', () => {
    assert.deepEqual(shape('twenty-five minutes'), ['number:25 min'])
    assert.deepEqual(shape('sixty-one kg'), ['number:61 kg'])
    assert.deepEqual(shape('thirty-five to forty minutes'), ['number:35 min', 'number:40 min'])
  })

  it('still needs a measurement around it, and adds no value the scan did not read before', () => {
    assert.deepEqual(shape('twenty-five'), [])
    assert.deepEqual(shape('ninety-nine'), [])
    assert.deepEqual(shape('thirty-five to forty percent'), ['percent:40 %'])
    assert.deepEqual(shape('thirty—five to forty percent'), ['percent:40 %'])
    assert.deepEqual(shape('thirty−five to forty percent'), ['percent:40 %'])
  })

  it('compares as the amount it states', () => {
    assert.equal(exactness('twenty-five percent', ['25% of users']), 1)
    assert.equal(exactness('twenty-five percent', ['20% of users']), 0)
    assert.equal(exactness('fifty-five percent', ['50%']), 0)
    assert.equal(exactness('$thirty-five to $forty', ['$35 and $40']), 1)
  })
})

describe('extractValues — range bounds take the range kind', () => {
  it('gives the bare lower bound of a percent range the percent kind', () => {
    for (const text of ['5-10%', '5 - 10%', '5–10%', '5—10%', 'up 5-10 per cent', '2024.5-2025.5%']) {
      assert.equal(shape(text)[0]?.startsWith('percent:'), true, text)
    }
    const [lo] = extractValues('costs fell 5-10%').values
    assert.equal(lo?.alsoBareNumber, true)
  })

  it('gives the bare upper bound of a currency range the currency kind', () => {
    assert.deepEqual(shape('$5-10'), ['currency:5 USD', 'currency:10 USD'])
    assert.deepEqual(shape('Bags cost $5-10.'), ['currency:5 USD', 'currency:10 USD'])
    assert.deepEqual(shape('costs $5-10, depending on size'), ['currency:5 USD', 'currency:10 USD'])
    assert.deepEqual(shape('$5-10.50'), ['currency:5 USD', 'currency:10.5 USD'])
    assert.deepEqual(shape('$5-10,000'), ['currency:5 USD', 'currency:10000 USD'])
    assert.deepEqual(shape('USD 5-10'), ['currency:5 USD', 'currency:10 USD'])
  })

  // Each of these was broken by an earlier attempt; each still reads exactly
  // as it did before the range kind existed.
  it('leaves every shape that is not a two-sided bare range alone', () => {
    const unchanged: [string, string[]][] = [
      ['By 2030 — 40% of companies', ['year:2030', 'percent:40 %']],
      ['In 2023 - 15% of firms', ['year:2023', 'percent:15 %']],
      ['revenue in 2024-25% growth', ['year:2024', 'percent:25 %']],
      ['Q3 2024-25% growth', ['number:3', 'year:2024', 'percent:25 %']],
      ['+2024-25%', ['number:2024', 'percent:25 %']],
      ['-2024-25%', ['number:-2024', 'percent:25 %']],
      ['+2024 to 25%', ['number:2024', 'percent:25 %']],
      ['Prices start at $10 — 20 seats included', ['currency:10 USD', 'number:20']],
      ['$5-10k seconds', ['currency:5 USD', 'number:10000']],
      ['$5-10 EUR', ['currency:5 USD', 'currency:10 EUR']],
      ['$5 to 10 people', ['currency:5 USD', 'number:10']],
      ['grew from 5 million to 10% share', ['number:5000000', 'percent:10 %']],
      ['grew from one to 15% of revenue', ['percent:15 %']],
      ['COVID-19 to 20% of', ['number:19', 'percent:20 %']],
      ['Q3-5%', ['number:3', 'percent:5 %']],
      ['FY24-25% growth', ['number:24', 'percent:25 %']],
      ['v2-3%', ['number:2', 'percent:3 %']],
      ['from 5 to 10 to 15%', ['number:5', 'number:10', 'percent:15 %']],
      ['between 5 and 10%', ['number:5', 'percent:10 %']],
      ['20%-30%', ['percent:20 %', 'percent:-30 %']],
      ['$5-2024', ['currency:5 USD', 'year:2024']],
      ['$1500-2000', ['currency:1500 USD', 'year:2000']],
      ['5 -10%', ['number:5', 'percent:-10 %']],
      ['5 — 10%', ['number:5', 'percent:10 %']],
      ['$5bn-10', ['currency:5000000000 USD', 'number:10']],
      ['costs $5-10x more', ['currency:5 USD', 'number:10']],
    ]
    for (const [text, expected] of unchanged) assert.deepEqual(shape(text), expected, text)
  })

  it('matches the same-kind form and everything the bare number matched', () => {
    assert.equal(exactness('costs fell 5-10%', ['costs fell 5% to 10%']), 1)
    assert.equal(exactness('costs fell 5-10%', ['costs fell between 5 and 10%']), 1)
    assert.equal(exactness('costs fell 5-10%', ['costs fell 5 - 10%']), 1)
    assert.equal(exactness('costs fell between 5 and 10%', ['costs fell 5-10%']), 1)
    assert.equal(exactness('Bags cost $5-10', ['bags cost $5 to $10']), 1)
    assert.equal(exactness('Bags cost $5-10', ['Bags cost $5 to 10']), 1)
    assert.equal(exactness('Bags cost $5-10', ['$5 - 10']), 1)
    assert.equal(exactness('$10-20 seats', ['$10 for 20 seats']), 1)
    assert.equal(exactness('Bags cost $5-10.', ['costs $5 and there are 10 left']), 1)
    assert.equal(exactness('2024.5-2025.5%', ['2024.5% to 2025.5%']), 1)
    assert.equal(exactness('2024.5-2025.5%', ['2024.5 units and 2025.5%']), 1)
    assert.equal(exactness('$5-10k seconds', ['$10']), 0)
    assert.equal(exactness('$5-10 EUR', ['$5 to $10']), 0.5)
  })

  // Anchors still read the bound as a bare number, so an excerpt that carries
  // the figure only in its range kind cannot start contradicting a qualifier.
  it('does not change which excerpts answer the qualifier checks', () => {
    assert.equal(exactness('fell $5—10', ['rose $10 for 20 seats', 'costs $5 and there are 10 left']), 1)
  })
})
