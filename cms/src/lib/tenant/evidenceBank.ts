/**
 * Evidence bank — the only first-party facts a draft may state.
 *
 * Everything a workspace knows about itself that a writer is allowed to put in
 * an article: verified claims with their sources and limits, plain facts that
 * need no hedging, and the claims somebody has already ruled out. A draft cites
 * an entry by its ref (`[E3]`), the generate stage strips the marker and
 * records the citation, and QA checks every first-party sentence back against
 * this list.
 *
 * Two rules make the asset work, and both are stated in the admin descriptions
 * as well as here, because they are the ones operators get wrong:
 *
 * - Proof travels with the claim. An entry without a source and its limits is
 *   an assertion, and the writer cannot tell the difference — which is why an
 *   unfinished row is not sent to the writer at all.
 * - A softened version of an unsupported claim is still unsupported. "Roughly
 *   the fastest" is the same claim as "the fastest" with the evidence removed,
 *   which is why rejected claims stay visible instead of being deleted: a row
 *   nobody can see comes back in the next draft.
 *
 * Rows never move between arrays on their own. A verified claim whose
 * `recheckAt` has passed is expired *at render time* — it drops out of the
 * usable list and appears under "Never state these" — and it stays where it is
 * until a person either re-verifies it or files it as rejected.
 *
 * Dependency-free like the rest of `lib/tenant/`: the global's hooks, the
 * readiness evaluator, the pipeline prompts, and the QA stage all import it.
 */

/** How hard a claim was checked, strongest first. */
export const VERIFICATION_DEPTHS = [
  'primary_document',
  'reproduced',
  'third_party_audit',
  'self_reported',
] as const

export type VerificationDepth = (typeof VERIFICATION_DEPTHS)[number]

/** Where a claim has been cleared for use. An empty list means everywhere. */
export const CLEARED_SURFACES = ['web', 'blog', 'ads', 'sales', 'social', 'pr'] as const

export type ClearedSurface = (typeof CLEARED_SURFACES)[number]

/** One checked, citable statement about the workspace. */
export interface VerifiedClaim {
  /** Stable `E<n>`, assigned by the global's hook and never reused. */
  ref: string
  claim: string
  primarySource: string
  sourceUrl: string
  /** `YYYY-MM-DD`, or '' when nobody recorded one. */
  sourceDate: string
  sampleOrMethod: string
  verificationDepth: VerificationDepth | ''
  limits: string
  /** Empty means cleared everywhere; otherwise only the listed surfaces. */
  clearedSurfaces: ClearedSurface[]
  /** `YYYY-MM-DD`. Past this date the claim is expired and may not be used. */
  recheckAt: string
}

/** A fact that needs no hedging and no limits: dates, names, places. */
export interface Fact {
  ref: string
  fact: string
  source: string
  owner: string
  lastConfirmedAt: string
}

export type RejectedStatus = 'rejected' | 'expired'

/** A claim somebody ruled out, kept visible so it does not come back. */
export interface RejectedClaim {
  ref: string
  claim: string
  status: RejectedStatus
  reason: string
  /** An `E`/`F` ref to use instead, or free text. */
  replacement: string
}

export interface EvidenceBankContent {
  verifiedClaims: VerifiedClaim[]
  facts: Fact[]
  rejectedClaims: RejectedClaim[]
}

export function emptyEvidenceBankContent(): EvidenceBankContent {
  return { verifiedClaims: [], facts: [], rejectedClaims: [] }
}

/**
 * How many usable claims reach the generate prompt.
 *
 * A cap rather than everything, because the bank is sent on every generate call
 * and a workspace with three hundred rows would spend more on repeating itself
 * than on the article. The cap is a prompt-size limit only: QA sends the whole
 * bank, so a claim past the cap is still enforced — the writer just was not
 * offered it.
 */
export const MAX_PROMPT_CLAIMS = 40

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>

const asRecord = (value: unknown): Loose =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/**
 * A date as `YYYY-MM-DD`.
 *
 * Payload stores a date column as a full ISO timestamp and `asOf` is a plain
 * day, so everything that compares the two truncates first and compares as
 * text: a day is the resolution any of these questions is asked at, and
 * lexicographic order on `YYYY-MM-DD` is chronological order.
 */
const asDay = (value: unknown): string => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  const raw = asString(value)
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

/** `[E4]`, `e4`, and `E4` all name the same entry; the bank stores the bare ref. */
export const normaliseEvidenceRef = (value: unknown): string => {
  const raw = asString(value).replace(/^\[|\]$/g, '').trim()
  return /^[EFR]\d+$/i.test(raw) ? raw.toUpperCase() : raw
}

const depthOf = (value: unknown): VerificationDepth | '' => {
  const raw = asString(value)
  return (VERIFICATION_DEPTHS as readonly string[]).includes(raw) ? (raw as VerificationDepth) : ''
}

const surfacesOf = (value: unknown): ClearedSurface[] => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const seen = new Set<ClearedSurface>()
  for (const entry of raw) {
    const name = asString(entry)
    if ((CLEARED_SURFACES as readonly string[]).includes(name)) seen.add(name as ClearedSurface)
  }
  return CLEARED_SURFACES.filter((surface) => seen.has(surface))
}

/**
 * Coerce a Payload document, a form state, or assistant output into clean
 * `EvidenceBankContent`, saying what had to be dropped. Never throws: this runs
 * inside admin hooks and a loader, where a thrown parser would surface as a
 * validation error about the wrong field.
 */
export function parseEvidenceBankContent(input: unknown): {
  content: EvidenceBankContent
  warnings: string[]
} {
  const warnings: string[] = []
  const raw = asRecord(input)
  const content = emptyEvidenceBankContent()

  content.verifiedClaims = asArray(raw.verifiedClaims)
    .map((row) => {
      const r = asRecord(row)
      return {
        ref: normaliseEvidenceRef(r.ref),
        claim: asString(r.claim),
        primarySource: asString(r.primarySource),
        sourceUrl: asString(r.sourceUrl),
        sourceDate: asDay(r.sourceDate),
        sampleOrMethod: asString(r.sampleOrMethod),
        verificationDepth: depthOf(r.verificationDepth),
        limits: asString(r.limits),
        clearedSurfaces: surfacesOf(r.clearedSurfaces),
        recheckAt: asDay(r.recheckAt),
      }
    })
    .filter((row) => {
      // A row with no claim text is nothing a writer could cite, and a row with
      // no ref cannot be cited at all — the hook assigns one on every save, so
      // a missing ref here means the value came from somewhere else.
      if (row.claim && row.ref) return true
      if (row.claim || row.primarySource) warnings.push('Dropped a verified claim with no claim text or no ref')
      return false
    })

  content.facts = asArray(raw.facts)
    .map((row) => {
      const r = asRecord(row)
      return {
        ref: normaliseEvidenceRef(r.ref),
        fact: asString(r.fact),
        source: asString(r.source),
        owner: asString(r.owner),
        lastConfirmedAt: asDay(r.lastConfirmedAt),
      }
    })
    .filter((row) => {
      if (row.fact && row.ref) return true
      if (row.fact || row.source) warnings.push('Dropped a fact with no fact text or no ref')
      return false
    })

  content.rejectedClaims = asArray(raw.rejectedClaims)
    .map((row) => {
      const r = asRecord(row)
      return {
        ref: normaliseEvidenceRef(r.ref),
        claim: asString(r.claim),
        status: asString(r.status) === 'expired' ? ('expired' as const) : ('rejected' as const),
        reason: asString(r.reason),
        replacement: asString(r.replacement),
      }
    })
    .filter((row) => {
      if (row.claim && row.ref) return true
      if (row.claim || row.reason) warnings.push('Dropped a rejected claim with no claim text or no ref')
      return false
    })

  return { content, warnings }
}

export function evidenceBankContentOf(input: unknown): EvidenceBankContent {
  return parseEvidenceBankContent(input).content
}

/**
 * Nothing has been written yet.
 *
 * The loader turns an empty bank into `null` rather than an empty object, so
 * every prompt consumer sees one signal for "no bank" and cannot accidentally
 * render three empty headings for a global nobody has opened.
 */
export function isEvidenceBankEmpty(content: EvidenceBankContent | null | undefined): boolean {
  if (!content) return true
  return (
    content.verifiedClaims.length === 0 &&
    content.facts.length === 0 &&
    content.rejectedClaims.length === 0
  )
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/** A claim whose re-check date has passed is expired: `recheckAt` before `asOf`. */
function expired(claim: VerifiedClaim, asOf: string): boolean {
  const day = asDay(asOf)
  return claim.recheckAt !== '' && day !== '' && claim.recheckAt < day
}

/**
 * What is still missing before this claim may be cited, in the words the
 * operator needs to act on.
 *
 * Proof travels with the claim, and a half-filled row is the shape that breaks
 * that rule quietly: it looks like evidence in the admin list and reads to the
 * writer as a checked fact. So a row without a source, a source date, a
 * verification stronger than somebody's word, or a date it has to be looked at
 * again is not evidence yet — it is a note about a claim somebody would like to
 * make. `self_reported` is listed as a depth because an operator has to be able
 * to record where a claim came from, not because it is enough to publish on:
 * the assistant stamps every row it proposes with exactly that value, and those
 * rows must not walk into a draft on their own.
 */
export function verifiedClaimProblems(claim: VerifiedClaim): string[] {
  const problems: string[] = []
  if (!claim.claim.trim()) problems.push('Write the claim')
  if (!claim.primarySource.trim()) problems.push('Name the primary source')
  if (!claim.sourceDate) problems.push('Give the date the source was produced')
  if (claim.verificationDepth === '') problems.push('Record how it was verified')
  else if (claim.verificationDepth === 'self_reported') {
    problems.push('Verify it beyond self-reported, or file it as rejected')
  }
  if (!claim.recheckAt) problems.push('Set a re-check date')
  return problems
}

/** A claim carrying everything a writer and a checker need. */
export function isClaimComplete(claim: VerifiedClaim): boolean {
  return verifiedClaimProblems(claim).length === 0
}

/**
 * A claim cleared for this surface. An empty `clearedSurfaces` means nobody
 * restricted it, which is cleared everywhere — the alternative reading, that an
 * unfilled field bans the claim, would make an operator who has not heard of
 * the field wonder why their bank is empty.
 */
function cleared(claim: VerifiedClaim, surface: string): boolean {
  return claim.clearedSurfaces.length === 0 || claim.clearedSurfaces.includes(surface as ClearedSurface)
}

/**
 * The claims a writer may be handed: complete, cleared for this surface, and
 * not expired.
 *
 * Completeness is part of usability rather than a separate warning, because
 * the only consumer that matters is the prompt, and a claim the writer can see
 * is a claim the writer will use. An unfinished row reaching a draft is exactly
 * the failure the bank exists to prevent — it arrives wearing the authority of
 * the checked rows beside it, with nothing behind it.
 */
export function usableClaims(
  bank: EvidenceBankContent | null | undefined,
  opts: { asOf: string; surface: string },
): VerifiedClaim[] {
  if (!bank) return []
  return bank.verifiedClaims.filter(
    (claim) => isClaimComplete(claim) && cleared(claim, opts.surface) && !expired(claim, opts.asOf),
  )
}

/** Verified rows that are not evidence yet, whatever else is true of them. */
export function incompleteClaims(
  bank: EvidenceBankContent | null | undefined,
): VerifiedClaim[] {
  if (!bank) return []
  return bank.verifiedClaims.filter((claim) => !isClaimComplete(claim))
}

export function expiredClaims(
  bank: EvidenceBankContent | null | undefined,
  asOf: string,
): VerifiedClaim[] {
  if (!bank) return []
  return bank.verifiedClaims.filter((claim) => expired(claim, asOf))
}

/** One row of the "Never state these" list. */
export interface NeverUseEntry {
  ref: string
  claim: string
  /** Why it may not be used, as a sentence fragment: `rejected: …`, `expired: …`. */
  reason: string
  /** An `E`/`F` ref or free text to use instead. Empty when there is none. */
  replacement: string
}

/**
 * Everything the writer must not state: the rows somebody ruled out, plus the
 * verified claims that have quietly gone stale.
 *
 * The union is the point. A claim that was true last quarter is exactly the one
 * a writer will reach for from memory, so it has to appear in the same list as
 * the claims that were never true — with the date that killed it, so an
 * operator reading the prompt back knows what to re-check.
 */
export function neverUseClaims(
  bank: EvidenceBankContent | null | undefined,
  asOf: string,
): NeverUseEntry[] {
  if (!bank) return []
  const rejected = bank.rejectedClaims.map((row) => ({
    ref: row.ref,
    claim: row.claim,
    reason: row.reason ? `${row.status}: ${row.reason}` : row.status,
    replacement: row.replacement,
  }))
  const stale = expiredClaims(bank, asOf).map((claim) => ({
    ref: claim.ref,
    claim: claim.claim,
    reason: `expired: re-check was due ${claim.recheckAt}; do not use until re-verified`,
    replacement: '',
  }))
  return [...rejected, ...stale]
}

export interface EvidenceBankSummary {
  /** Every verified claim, complete or not, expired or not. */
  verified: number
  /** Verified claims a writer may be handed on some surface: complete and unexpired. */
  usable: number
  expired: number
  /** Verified rows still missing a source, a date, real verification, or a re-check date. */
  incomplete: number
  facts: number
  rejected: number
}

/**
 * The counts the setup hub and readiness report.
 *
 * Surface-independent on purpose: readiness answers "has this workspace got
 * anything a writer can cite", and a claim cleared for sales only is still
 * evidence somebody did the work to gather.
 */
export function evidenceBankSummary(
  bank: EvidenceBankContent | null | undefined,
  asOf: string,
): EvidenceBankSummary {
  const claims = bank?.verifiedClaims ?? []
  return {
    verified: claims.length,
    // Counted the same way the prompt picks them, minus the surface: a row that
    // reaches no draft must not be reported to the operator as evidence.
    usable: claims.filter((claim) => isClaimComplete(claim) && !expired(claim, asOf)).length,
    expired: expiredClaims(bank, asOf).length,
    incomplete: incompleteClaims(bank).length,
    facts: bank?.facts.length ?? 0,
    rejected: bank?.rejectedClaims.length ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Refs in generated text
// ---------------------------------------------------------------------------

/**
 * Case-insensitive, because the model is copying a ref out of the prompt by
 * eye and `[e3]` is the same citation as `[E3]` to everyone but a regex. The
 * captured ref is normalised to upper case before it goes anywhere, so the
 * stored citation, the QA check, and the bank all spell it one way.
 */
const REF_PATTERN = /\[([EFR]\d+)\]/gi

/** Every evidence ref cited in a piece of generated text, de-duplicated in order. */
export function evidenceRefsIn(text: string | null | undefined): string[] {
  if (!text) return []
  const seen = new Set<string>()
  const refs: string[] = []
  for (const match of text.matchAll(REF_PATTERN)) {
    const ref = normaliseEvidenceRef(match[1])
    if (seen.has(ref)) continue
    seen.add(ref)
    refs.push(ref)
  }
  return refs
}

/**
 * Remove the citation markers, and the space that carried them, from generated
 * text.
 *
 * Only `[E3]`-shaped markers: a draft legitimately contains other bracketed
 * text — a markdown link, `[sic]`, an array index in a code sample — and a
 * greedy strip would silently mangle the article. The markers are an internal
 * protocol between the prompt and QA, and no reader should ever see one, so
 * this runs on every generated string field before anything is stored — in
 * either case, since a model that types `[e3]` must not leave the marker in the
 * published text just because it shouted less than the prompt did.
 */
export function stripEvidenceRefs(text: string): string {
  return text.replace(/[ \t]*\[([EFR]\d+)\]/gi, '')
}

/** What the deterministic half of the evidence check found about one ref. */
export interface EvidenceRefCheck {
  /** Refs that exist and may be used as of `asOf`. */
  ok: string[]
  /** Refs the bank has never heard of. */
  unknown: string[]
  /** Refs that exist but must not be cited, with the reason. */
  unusable: { ref: string; reason: string }[]
}

/**
 * The half of the evidence check that needs no model: every ref the writer
 * cited must exist and still be usable *on the surface this draft is for*.
 *
 * Surface-aware, because the check has to answer the same question the prompt
 * did. A claim cleared for sales only is a real row with real proof behind it,
 * so reporting it as an unknown ref would send a reviewer looking for a
 * hallucination that is not there; it is a clearance problem, and it says so.
 * The same goes for a row nobody finished: the draft cited something that was
 * never evidence, and "incomplete evidence" is the sentence that gets it fixed.
 */
export function checkEvidenceRefs(
  refs: string[],
  bank: EvidenceBankContent | null | undefined,
  opts: { asOf: string; surface: string },
): EvidenceRefCheck {
  const result: EvidenceRefCheck = { ok: [], unknown: [], unusable: [] }
  for (const raw of refs) {
    const ref = normaliseEvidenceRef(raw)
    const claim = bank?.verifiedClaims.find((row) => row.ref === ref)
    if (claim) {
      if (expired(claim, opts.asOf)) {
        result.unusable.push({
          ref,
          reason: `expired: re-check was due ${claim.recheckAt}`,
        })
      } else if (!isClaimComplete(claim)) {
        result.unusable.push({ ref, reason: 'incomplete evidence' })
      } else if (!cleared(claim, opts.surface)) {
        result.unusable.push({ ref, reason: `not cleared for ${opts.surface}` })
      } else {
        result.ok.push(ref)
      }
      continue
    }
    if (bank?.facts.some((row) => row.ref === ref)) {
      result.ok.push(ref)
      continue
    }
    const rejected = bank?.rejectedClaims.find((row) => row.ref === ref)
    if (rejected) {
      result.unusable.push({
        ref,
        reason: rejected.reason ? `${rejected.status}: ${rejected.reason}` : rejected.status,
      })
      continue
    }
    result.unknown.push(ref)
  }
  return result
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

/** A replacement that names an entry is rendered as a ref; anything else verbatim. */
const replacementText = (value: string): string =>
  /^[EFR]\d+$/.test(value) ? `[${value}]` : value

function renderClaim(claim: VerifiedClaim): string {
  const parts = [`[${claim.ref}] ${sentence(claim.claim)}`]
  if (claim.primarySource) {
    parts.push(
      claim.sourceDate
        ? `Source: ${claim.primarySource}, ${claim.sourceDate}.`
        : `Source: ${sentence(claim.primarySource)}`,
    )
  }
  if (claim.sampleOrMethod) parts.push(`Method: ${sentence(claim.sampleOrMethod)}`)
  if (claim.limits) parts.push(`Limits: ${sentence(claim.limits)}`)
  if (claim.clearedSurfaces.length > 0) parts.push(`Cleared: ${claim.clearedSurfaces.join(', ')}.`)
  return `- ${parts.join(' ')}`
}

function renderFact(fact: Fact): string {
  const notes = [
    'fact',
    fact.owner ? `owner: ${fact.owner}` : '',
    fact.lastConfirmedAt ? `confirmed ${fact.lastConfirmedAt}` : '',
  ].filter(Boolean)
  return `- [${fact.ref}] ${sentence(fact.fact)} (${notes.join('; ')})`
}

function renderNeverUse(row: NeverUseEntry): string {
  const instead = row.replacement ? ` Say instead: ${replacementText(row.replacement)}.` : ''
  return `- [${row.ref}] "${row.claim}" — ${row.reason}.${instead}`
}

/**
 * The `# Evidence bank` block for the generate user prompt and the evidence
 * check.
 *
 * Returns null for a workspace with no bank, so the caller omits the section
 * rather than sending a heading with nothing under it — a heading the model
 * would read as an invitation to invent entries for.
 *
 * Usable claims are capped (`MAX_PROMPT_CLAIMS` by default, `Infinity` for the
 * QA call which must see everything) and ordered by re-check date, newest
 * first, so the cap drops the claims closest to going stale rather than an
 * arbitrary slice. Undated claims sort last; a usable claim always carries a
 * re-check date, so that branch is only what keeps the ordering total. Facts
 * and never-use rows are never capped — the never-use list in particular has to
 * be complete, because a missing row is a claim that comes back.
 */
export function evidenceBankToPrompt(
  bank: EvidenceBankContent | null | undefined,
  opts: { asOf: string; surface: string; companyName?: string; cap?: number },
): string | null {
  if (isEvidenceBankEmpty(bank)) return null
  const cap = opts.cap ?? MAX_PROMPT_CLAIMS

  const claims = usableClaims(bank, { asOf: opts.asOf, surface: opts.surface })
    .slice()
    .sort((a, b) => {
      if (a.recheckAt !== b.recheckAt) {
        if (a.recheckAt === '') return 1
        if (b.recheckAt === '') return -1
        return b.recheckAt.localeCompare(a.recheckAt)
      }
      return a.ref.localeCompare(b.ref)
    })
    .slice(0, cap)

  const subject = opts.companyName?.trim()
  const heading = subject
    ? `# Evidence bank (the only first-party facts you may state about ${subject})`
    : '# Evidence bank (the only first-party facts you may state)'

  const lines: string[] = [
    heading,
    'Cite the ref after the sentence that uses it. Stay within "Limits".',
    ...claims.map(renderClaim),
    ...(bank?.facts ?? []).map(renderFact),
  ]

  const neverUse = neverUseClaims(bank, opts.asOf)
  const sections = [lines.join('\n')]
  if (neverUse.length > 0) {
    sections.push(`## Never state these\n${neverUse.map(renderNeverUse).join('\n')}`)
  }
  return sections.join('\n\n')
}

/**
 * The novelty and first-party boundary, stated verbatim in the generate prompt.
 *
 * One function rather than a constant because the second rule names the
 * company and changes shape with the bank: a workspace that has written one
 * down may state what is in it, and a workspace that has not may state nothing
 * about itself at all. Getting that backwards is how a draft ends up inventing
 * a customer count.
 */
export function evidenceRules(companyName: string, hasBank: boolean): string {
  const subject = companyName.trim() || 'this company'
  const firstParty = hasBank
    ? `First-party facts — anything about ${subject}, its product, customers, results, pricing, ` +
      'or measurements — may be stated only when they appear in the Evidence bank below. Put the ' +
      'entry\'s ref in square brackets at the end of the sentence that uses it, e.g. "…within 40 ms ' +
      '[E3]." Stay within the entry\'s stated limits.'
    : `First-party facts — anything about ${subject}, its product, customers, results, pricing, ` +
      'or measurements — may not be stated at all: this workspace has no evidence bank, so there ' +
      'is nothing to cite and nothing you could write here would be checkable.'
  return [
    'Do not invent unique insights. Add a novel factual claim only when you can name the public ' +
      'source (organisation and document) a fact-checker could find; otherwise state it as an ' +
      "explicitly labelled inference (for example, 'In our reading of the guidance…').",
    firstParty,
    ...(hasBank
      ? [
          'Never state anything in "Never state these", even paraphrased; use the replacement ' +
            'where one is given.',
        ]
      : []),
    'Prefer covering every consensus facet over adding novelty. Every number, date, and ' +
      'percentage must be one you can attribute.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Ref assignment
// ---------------------------------------------------------------------------

/**
 * The next ref for a prefix, given the counter the global carries.
 *
 * One counter across all three arrays rather than one each: refs only have to
 * be unique and stable, `E7` and `F7` never coexisting costs nothing, and a
 * single number is one thing to keep monotonic instead of three. A ref is never
 * reused after a row is deleted, because a deleted `E4` may still be cited by a
 * published article's `evidenceCitations`, and pointing that citation at a
 * different claim would rewrite history silently.
 */
export function nextRef(prefix: 'E' | 'F' | 'R', counter: number): string {
  return `${prefix}${counter}`
}
