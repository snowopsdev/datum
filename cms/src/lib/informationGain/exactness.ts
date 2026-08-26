/**
 * Information gain — deterministic value extraction and exactness comparison.
 *
 * The numeric gate never asks a model whether two figures agree: it pulls the
 * numbers, units, dates, direction, and negation out of both the claim and its
 * evidence with regexes and compares them literally. No unit conversion and no
 * rounding — `380 ms` and `0.38 s` are a mismatch on purpose, because a model
 * that silently rescales units can turn a wrong number into a passing one.
 *
 * Like the rest of `cms/src/lib/informationGain/`, this file stays free of
 * `next`, `react`, `payload`, `@/` aliases, `process.env`, and `node:*` imports
 * so the pipeline can import it directly.
 */

export type ValueKind = 'number' | 'percent' | 'currency' | 'year' | 'date'

export interface ExtractedValue {
  kind: ValueKind
  value: number
  /** Canonical unit (`%`, `USD`, `s`, `km`, …) or null when the value carries none. */
  unit: string | null
  /** The text the value was read from, quoted back in mismatch messages. */
  raw: string
}

export interface TextValues {
  values: ExtractedValue[]
  negated: boolean
  direction: 'increase' | 'decrease' | null
  comparative: 'more' | 'less' | 'equal' | null
}

/** Word numbers we accept. Deliberately small: one…twenty plus the round tens. */
const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
}

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  m: 1_000_000,
  million: 1_000_000,
  bn: 1_000_000_000,
  billion: 1_000_000_000,
}

/** Unit token → canonical short form. Long spellings map onto the short one. */
const UNIT_CANONICAL: Record<string, string> = {
  ms: 'ms',
  millisecond: 'ms',
  milliseconds: 'ms',
  s: 's',
  sec: 's',
  secs: 's',
  second: 's',
  seconds: 's',
  min: 'min',
  mins: 'min',
  minute: 'min',
  minutes: 'min',
  h: 'h',
  hr: 'h',
  hrs: 'h',
  hour: 'h',
  hours: 'h',
  day: 'day',
  days: 'day',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
  year: 'year',
  years: 'year',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  mg: 'mg',
  ml: 'ml',
  l: 'l',
  mm: 'mm',
  cm: 'cm',
  m: 'm',
  km: 'km',
  mi: 'mi',
  mile: 'mi',
  miles: 'mi',
  ft: 'ft',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

const CURRENCY_BY_SYMBOL: Record<string, string> = { $: 'USD', '€': 'EUR', '£': 'GBP' }

/** Longest alternative first, so `s` can never win against `seconds`. */
const byLengthDesc = (tokens: string[]): string =>
  [...tokens].sort((a, b) => b.length - a.length || a.localeCompare(b)).join('|')

const MONTH_SRC = byLengthDesc(Object.keys(MONTHS))
const UNIT_SRC = byLengthDesc(Object.keys(UNIT_CANONICAL))
const WORD_NUMBER_SRC = byLengthDesc(Object.keys(WORD_NUMBERS))

/** `1.5`, `20,000`, `20K`, `1.5 million`. A bare `k`/`m`/`bn` must touch the digits. */
const DIGIT_AMOUNT = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`
const MULTIPLIER = String.raw`(?:(?:k|m|bn)\b|\s?(?:thousand|million|billion)\b)`
const NUMERIC_AMOUNT = String.raw`(?:${DIGIT_AMOUNT})(?:${MULTIPLIER})?`
/**
 * Word numbers count only where a unit, range, percent, or currency marks the
 * token as a measurement. A bare "one of the best ways" is prose, and reading a
 * value out of it would manufacture exactness mismatches from ordinary text.
 */
const AMOUNT = String.raw`(?:${NUMERIC_AMOUNT}|${WORD_NUMBER_SRC})`

/**
 * One left-to-right scan; alternatives are tried in order at each position, so
 * this list *is* the precedence: dates, then percent, then currency, then
 * ranges and united numbers, then a bare number (re-classified as a year below).
 */
const VALUE_PATTERN = new RegExp(
  [
    String.raw`\b(?<isoY>\d{4})-(?<isoM>\d{1,2})-(?<isoD>\d{1,2})\b`,
    String.raw`\b(?<dmyD>\d{1,2})(?:st|nd|rd|th)?\s+(?<dmyM>${MONTH_SRC})\.?,?\s+(?<dmyY>\d{4})\b`,
    String.raw`\b(?<mdyM>${MONTH_SRC})\.?\s+(?<mdyD>\d{1,2})(?:st|nd|rd|th)?(?:,\s*|\s+)(?<mdyY>\d{4})\b`,
    String.raw`\b(?<myM>${MONTH_SRC})\.?,?\s+(?<myY>\d{4})\b`,
    String.raw`(?<pct>${AMOUNT})\s*(?:%|per\s?cent\b)`,
    String.raw`(?<symbol>[$€£])\s*(?<symAmount>${AMOUNT})`,
    String.raw`\b(?<codePre>usd|eur|gbp)\s*(?<codePreAmount>${AMOUNT})`,
    String.raw`(?<codeSufAmount>${AMOUNT})\s*(?<codeSuf>usd|eur|gbp)\b`,
    String.raw`(?<rangeLo>${AMOUNT})\s*(?:to|[-–—])\s*(?<rangeHi>${AMOUNT})\s*(?<rangeUnit>${UNIT_SRC})\b`,
    // Before the united-number rule, so `1.5m` is 1,500,000 rather than 1.5 metres.
    String.raw`(?<multAmount>(?:${DIGIT_AMOUNT})${MULTIPLIER})`,
    String.raw`(?<numAmount>${AMOUNT})\s*(?<numUnit>${UNIT_SRC})\b`,
    String.raw`(?<bare>${NUMERIC_AMOUNT})`,
  ].join('|'),
  'gi',
)

const NEGATION_PATTERN =
  /\b(?:not|no|never|without|cannot|can't|don't|doesn't|isn't|aren't|won't|shouldn't)\b/i

const DIRECTION_PATTERN =
  /\b(?:(increase(?:s|d)?|rise(?:s)?|rose|grow(?:s)?|grew|higher|faster|more|up|gain(?:s)?|improve(?:s|d)?)|(decrease(?:s|d)?|reduce(?:s|d)?|reduction|drop(?:s|ped)?|fall(?:s)?|fell|lower|slower|less|down|cut(?:s)?|shrink(?:s)?))\b/i

const COMPARATIVE_PATTERN =
  /\b(?:(more than|greater than|above|over|exceeds)|(less than|fewer than|below|under)|(equal to|same as|exactly))\b/i

/** Turns one matched amount ("20,000", "1.5m", "four") into its numeric value. */
function parseAmount(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const text = raw.trim().toLowerCase()
  const digits = /^([\d,]+(?:\.\d+)?)\s?(k|m|bn|thousand|million|billion)?$/.exec(text)
  if (digits) {
    const value = Number(digits[1].replace(/,/g, ''))
    if (!Number.isFinite(value)) return null
    return digits[2] ? value * MULTIPLIERS[digits[2]] : value
  }
  return WORD_NUMBERS[text] ?? null
}

const monthNumber = (name: string): number => MONTHS[name.trim().toLowerCase()] ?? 0

/** Dates compare at month resolution: `2026-01-05` and `Jan 2026` are both 202601. */
const yyyymm = (year: number, month: number): number => year * 100 + month

/** Which value a match produced, or null when the match yielded nothing usable. */
function valueFromMatch(match: RegExpExecArray): ExtractedValue | ExtractedValue[] | null {
  const g = match.groups ?? {}
  const raw = match[0].trim()

  if (g.isoY !== undefined) {
    return { kind: 'date', value: yyyymm(Number(g.isoY), Number(g.isoM)), unit: null, raw }
  }
  if (g.dmyY !== undefined) {
    return { kind: 'date', value: yyyymm(Number(g.dmyY), monthNumber(g.dmyM)), unit: null, raw }
  }
  if (g.mdyY !== undefined) {
    return { kind: 'date', value: yyyymm(Number(g.mdyY), monthNumber(g.mdyM)), unit: null, raw }
  }
  if (g.myY !== undefined) {
    return { kind: 'date', value: yyyymm(Number(g.myY), monthNumber(g.myM)), unit: null, raw }
  }

  if (g.pct !== undefined) {
    const value = parseAmount(g.pct)
    return value === null ? null : { kind: 'percent', value, unit: '%', raw }
  }

  const currencyCode =
    g.symbol !== undefined ? CURRENCY_BY_SYMBOL[g.symbol] : (g.codePre ?? g.codeSuf)?.toUpperCase()
  const currencyAmount = g.symAmount ?? g.codePreAmount ?? g.codeSufAmount
  if (currencyCode !== undefined && currencyAmount !== undefined) {
    const value = parseAmount(currencyAmount)
    return value === null ? null : { kind: 'currency', value, unit: currencyCode, raw }
  }

  if (g.rangeUnit !== undefined) {
    const unit = UNIT_CANONICAL[g.rangeUnit.toLowerCase()] ?? null
    const lo = parseAmount(g.rangeLo)
    const hi = parseAmount(g.rangeHi)
    // Each bound is quoted back with the shared unit, so a mismatch on the upper
    // bound of "25 to 30 seconds" reads "30 s", not the whole range.
    const quote = (amount: string): string => (unit === null ? amount : `${amount} ${unit}`)
    const bounds: ExtractedValue[] = []
    if (lo !== null) bounds.push({ kind: 'number', value: lo, unit, raw: quote(g.rangeLo) })
    if (hi !== null) bounds.push({ kind: 'number', value: hi, unit, raw: quote(g.rangeHi) })
    return bounds.length > 0 ? bounds : null
  }

  if (g.multAmount !== undefined) {
    const value = parseAmount(g.multAmount)
    return value === null ? null : { kind: 'number', value, unit: null, raw }
  }

  if (g.numUnit !== undefined) {
    const value = parseAmount(g.numAmount)
    if (value === null) return null
    return { kind: 'number', value, unit: UNIT_CANONICAL[g.numUnit.toLowerCase()] ?? null, raw }
  }

  if (g.bare !== undefined) {
    const value = parseAmount(g.bare)
    if (value === null) return null
    // A standalone four-digit 1900–2099 integer is a year; `12026` and `2026.5`
    // matched as one longer token above, so they stay plain numbers.
    const isYear = /^\d{4}$/.test(g.bare) && value >= 1900 && value <= 2099
    return { kind: isYear ? 'year' : 'number', value, unit: null, raw }
  }

  return null
}

function directionOf(text: string): TextValues['direction'] {
  const match = DIRECTION_PATTERN.exec(text)
  if (!match) return null
  return match[1] !== undefined ? 'increase' : 'decrease'
}

function comparativeOf(text: string): TextValues['comparative'] {
  const match = COMPARATIVE_PATTERN.exec(text)
  if (!match) return null
  if (match[1] !== undefined) return 'more'
  return match[2] !== undefined ? 'less' : 'equal'
}

/** Pulls every comparable signal out of one excerpt. Pure and deterministic. */
export function extractValues(text: string): TextValues {
  const source = typeof text === 'string' ? text : ''
  // Curly apostrophes would otherwise hide "can’t" from the negation scan.
  const normalised = source.replace(/[‘’]/g, "'")

  const values: ExtractedValue[] = []
  VALUE_PATTERN.lastIndex = 0
  let match = VALUE_PATTERN.exec(normalised)
  while (match !== null) {
    const produced = valueFromMatch(match)
    if (Array.isArray(produced)) values.push(...produced)
    else if (produced !== null) values.push(produced)
    // Zero-length matches cannot happen with these alternatives, but a stuck
    // lastIndex would loop forever, so step past it defensively.
    if (match[0].length === 0) VALUE_PATTERN.lastIndex += 1
    match = VALUE_PATTERN.exec(normalised)
  }

  return {
    values,
    negated: NEGATION_PATTERN.test(normalised),
    direction: directionOf(normalised),
    comparative: comparativeOf(normalised),
  }
}

/** True when the text carries any number, amount, or date the gate must verify. */
export function hasNumericOrTemporal(v: TextValues): boolean {
  return v.values.length > 0
}

/** Same kind, same value, and — when both carry one — the same unit. No conversion. */
function sameValue(a: ExtractedValue, b: ExtractedValue): boolean {
  if (a.kind !== b.kind) return false
  if (Math.abs(a.value - b.value) > 1e-9) return false
  if (a.unit !== null && b.unit !== null && a.unit !== b.unit) return false
  return true
}

const OPPOSITE: Record<'increase' | 'decrease', 'increase' | 'decrease'> = {
  increase: 'decrease',
  decrease: 'increase',
}

/** How a comparative reads in a mismatch message. */
const COMPARATIVE_LABEL: Record<'more' | 'less' | 'equal', string> = {
  more: 'more than',
  less: 'less than',
  equal: 'exactly',
}

/**
 * How much of the claim the evidence literally supports: the share of its
 * values, its direction, its negation, and its comparative that the evidence
 * excerpts confirm. `exactness = matched / comparable`, and a claim with nothing
 * comparable scores 1 — it is the policy gate's job, not this function's, to
 * decide whether an unfalsifiable claim may pass.
 *
 * The four checks each contribute at most one comparable:
 *
 * - **values** — one comparable per claim value; matched when any evidence
 *   excerpt carries the same kind, value, and unit. No conversion.
 * - **direction** — one comparable when the claim states one; matched unless the
 *   evidence states the opposite direction and never the claim's.
 * - **negation** — compared *symmetrically*: the check runs whenever the claim
 *   or any evidence excerpt is negated, and is matched only when some excerpt's
 *   negation equals the claim's. So an affirmative "80% recommend it" against
 *   "80% do not recommend it" is a mismatch, not a silent pass — the numbers
 *   agree while the propositions are opposites.
 * - **comparative** — one comparable when the claim states one. `more`/`less`
 *   are thresholds: only evidence asserting the same threshold supports them, so
 *   a bare "10%" does not support "more than 10%". `equal` is what a bare figure
 *   already asserts, so evidence with `equal` or with no comparative at all
 *   supports it; only opposing threshold evidence fails it.
 *
 * As with negation, an empty evidence list supports nothing: it can satisfy
 * neither the negation nor the comparative check.
 */
export function compareValues(
  claim: TextValues,
  evidence: TextValues[],
): { exactness: number; mismatches: string[] } {
  const mismatches: string[] = []
  const evidenceValues = evidence.flatMap((e) => e.values)
  let comparable = 0
  let matched = 0

  for (const value of claim.values) {
    comparable += 1
    if (evidenceValues.some((candidate) => sameValue(value, candidate))) {
      matched += 1
    } else {
      mismatches.push(`${value.raw} (${value.kind}) not found in evidence`)
    }
  }

  if (claim.direction !== null) {
    comparable += 1
    const opposite = OPPOSITE[claim.direction]
    const contradicted =
      evidence.some((e) => e.direction === opposite) &&
      !evidence.some((e) => e.direction === claim.direction)
    if (contradicted) {
      mismatches.push(`direction: claim says ${claim.direction}, evidence says ${opposite}`)
    } else {
      matched += 1
    }
  }

  // Symmetric: opposite negation is a mismatch whichever side carries it.
  if (claim.negated || evidence.some((e) => e.negated)) {
    comparable += 1
    if (evidence.some((e) => e.negated === claim.negated)) {
      matched += 1
    } else if (claim.negated) {
      mismatches.push('negation: claim is negated, evidence is not')
    } else {
      mismatches.push('negation: claim is affirmative, evidence is negated')
    }
  }

  if (claim.comparative !== null) {
    comparable += 1
    const supported = evidence.some(
      (e) =>
        e.comparative === claim.comparative ||
        (claim.comparative === 'equal' && e.comparative === null),
    )
    if (supported) {
      matched += 1
    } else {
      mismatches.push(
        `comparative: claim asserts ${COMPARATIVE_LABEL[claim.comparative]} the stated value, evidence does not`,
      )
    }
  }

  // With no evidence excerpts at all, a claim that asserts a value is
  // unsupported outright: the direction and negation checks pass vacuously
  // (nothing contradicts them) and must not be allowed to inflate the score.
  if (evidence.length === 0 && claim.values.length > 0) return { exactness: 0, mismatches }

  return { exactness: comparable === 0 ? 1 : matched / comparable, mismatches }
}
