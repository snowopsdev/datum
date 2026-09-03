/**
 * The setup assistant — "Draft with AI" and "Refine" on the onboarding steps.
 *
 * One section of one asset at a time, never a whole record: the operator is
 * looking at a step, the notes they just typed belong to that step, and a reply
 * scoped to it is a reply they can read before accepting. Nothing here saves
 * anything — the action returns a value, the editor merges it into form state,
 * and the existing per-asset save action is still what writes the audit row.
 *
 * Two rules shape everything below, and both exist because this is the one
 * place a model gets to write into the workspace's own record of itself:
 *
 * - The assistant reads only what the workspace already has: the profile, the
 *   brand voice, the other audiences, the position, the evidence bank, and the
 *   pages fetched from the company's own site. It is rendered with the same
 *   renderers the pipeline uses, so the assistant and the writer see one truth.
 * - Nothing it proposes is ever a finding. Confidence is capped at `inference`
 *   (`capAssistConfidence`), evidence rows come back unverified and unref'd,
 *   and a source URL survives only when it appears literally in the material.
 *   A person raises a claim; a model never does.
 *
 * Dependency-free like the rest of `lib/tenant/`: the tests import it from the
 * pipeline workspace, and the server action is the only thing that may touch
 * `payload`.
 */

import {
  type BrandVoiceContent,
  brandVoiceToPrompt,
} from '../brandVoice'
import { CONFIDENCE_LEVELS, CONFIDENCE_USAGE } from './confidence'
import {
  type EvidenceBankContent,
  evidenceBankToPrompt,
  parseEvidenceBankContent,
} from './evidenceBank'
import {
  capAssistConfidence,
  emptyIcpContent,
  type IcpContent,
  icpToPrompt,
  parseIcpContent,
} from './icp'
import {
  emptyPositioningContent,
  parsePositioningContent,
  type PositioningContent,
  positioningToPrompt,
} from './positioning'
import {
  normaliseDomain,
  type ResolvedWorkspaceProfile,
  workspaceProfileToPrompt,
} from './workspaceProfile'

export type AssistAsset = 'workspace' | 'icp' | 'positioning' | 'evidence'

export type AssistMode = 'draft' | 'refine'

export interface AssistInput {
  asset: AssistAsset
  section: string
  mode: AssistMode
  /** The operator's notes for this step. May be ''. */
  notes: string
  /** The section's current value; used by `refine`, ignored by `draft`. */
  current: unknown
  /** `asset === 'icp'`: the record being edited. Omitted for a new audience. */
  icpId?: number
}

/**
 * How much of one site page the assistant is shown.
 *
 * A third of what `sitePages` stores. The stored cap exists so a page survives
 * a re-fetch intact; this one exists because eight bodies ride along on every
 * assist call, and the part of a marketing page that says who the company is
 * always comes before the footer.
 */
export const ASSIST_PAGE_TEXT_CAP = 3_000

/**
 * Which keys of the asset's content type each section owns.
 *
 * The single source of truth for the whole feature: `ASSIST_SECTIONS` (what the
 * action accepts), the schema paragraph in the system prompt, the keys picked
 * out of the reply, and the mock fixtures are all derived from this table, so a
 * section cannot exist in one of them and not the others.
 */
const SECTION_KEYS = {
  workspace: {
    profile: ['companyName', 'competitors', 'siteNotes'],
  },
  icp: {
    who: ['who'],
    pains: ['pains'],
    motivation: ['motivation'],
    solution: ['solution'],
    competition: ['competition'],
    whyUs: ['whyUs'],
    channels: ['channels'],
    boundaries: ['churnTriggers', 'notOurUser'],
    all: [
      'name',
      'who',
      'pains',
      'motivation',
      'solution',
      'competition',
      'whyUs',
      'channels',
      'churnTriggers',
      'notOurUser',
    ],
  },
  positioning: {
    core: ['category', 'goal', 'promise', 'activePosition', 'statement'],
    frame: ['macroFrame', 'landscape'],
    coreClaims: ['coreClaims'],
    pillars: ['pillars'],
    identity: ['enemy', 'archetype', 'essence'],
    language: ['descriptorLadder', 'vocabularyReachFor', 'vocabularyAvoid'],
    openRulings: ['openRulings'],
    all: [
      'category',
      'goal',
      'promise',
      'activePosition',
      'statement',
      'macroFrame',
      'landscape',
      'coreClaims',
      'pillars',
      'enemy',
      'archetype',
      'essence',
      'descriptorLadder',
      'vocabularyReachFor',
      'vocabularyAvoid',
      'openRulings',
    ],
  },
  evidence: {
    facts: ['facts'],
    verifiedClaims: ['verifiedClaims'],
  },
} as const satisfies Record<AssistAsset, Record<string, readonly string[]>>

export const ASSIST_ASSETS: readonly AssistAsset[] = Object.keys(SECTION_KEYS) as AssistAsset[]

/** The sections each asset offers, in the order the editors step through them. */
export const ASSIST_SECTIONS: Record<AssistAsset, readonly string[]> = Object.fromEntries(
  ASSIST_ASSETS.map((asset) => [asset, Object.keys(SECTION_KEYS[asset])]),
) as unknown as Record<AssistAsset, readonly string[]>

export function isAssistAsset(value: unknown): value is AssistAsset {
  return typeof value === 'string' && (ASSIST_ASSETS as readonly string[]).includes(value)
}

export function isAssistSection(asset: AssistAsset, section: unknown): boolean {
  return typeof section === 'string' && ASSIST_SECTIONS[asset].includes(section)
}

/**
 * The content keys a section owns. Throws rather than returning nothing,
 * because every caller of this has already validated the section and a silent
 * empty answer would return an empty draft instead of saying what went wrong.
 */
export function assistSectionKeys(asset: AssistAsset, section: string): readonly string[] {
  const keys = (SECTION_KEYS as Record<string, Record<string, readonly string[]>>)[asset]?.[section]
  if (!keys) throw new Error(`Unknown assist section "${section}" for asset "${asset}"`)
  return keys
}

/** The section's slice of a full content record. */
export function pickAssistSection(
  asset: AssistAsset,
  section: string,
  content: Record<string, unknown>,
): Record<string, unknown> {
  const value: Record<string, unknown> = {}
  for (const key of assistSectionKeys(asset, section)) value[key] = content[key]
  return value
}

// ---------------------------------------------------------------------------
// The system prompt
// ---------------------------------------------------------------------------

/**
 * The confidence levels the assistant may use.
 *
 * The two "state it plainly" levels are missing on purpose: they are assertions
 * about the world, and a model reading marketing copy has neither interviews
 * nor data to make one. `parseAssistReply` caps anything higher anyway; naming
 * only the permitted levels here stops the model spending a field on a value
 * that will be taken away from it.
 */
const ASSIST_CONFIDENCE_LEVELS = CONFIDENCE_LEVELS.filter(
  (level) => CONFIDENCE_USAGE[level] !== 'state',
)

const CONFIDENCE_FIELD = `"confidence": one of ${ASSIST_CONFIDENCE_LEVELS.map((level) => `"${level}"`).join(' | ')}`

/** One JSON key of one asset, as the schema paragraph states it. */
const KEY_SCHEMA: Record<AssistAsset, Record<string, string>> = {
  workspace: {
    companyName: '"companyName": string (what the company calls itself in prose)',
    competitors:
      '"competitors": [{ "domain": string (a bare host: no scheme, no path), "name": string (what prose calls them) }]',
    siteNotes:
      '"siteNotes": string (two to four sentences: what this company sells, to whom, and how it is different — plain words, no marketing adjectives)',
  },
  icp: {
    name: '"name": string (a short label for this audience: the role plus the kind of company)',
    who: '"who": string (one line: the role, the size and kind of company, and what they are measured on)',
    pains: `"pains": [{ "statement": string, "evidence": [{ "ref": string (where it came from: a page path, an interview, a quote), "note": string }], ${CONFIDENCE_FIELD} }]`,
    motivation: `"motivation": { "text": string, "hypothesis": boolean, ${CONFIDENCE_FIELD} }`,
    solution: `"solution": { "mechanism": string, "sampleLines": [string], ${CONFIDENCE_FIELD} }`,
    competition: `"competition": [{ "competitor": string, "claim": string (their words, quoted), "claimedAt": "YYYY-MM-DD", "source": string (the page you read it on), ${CONFIDENCE_FIELD} }]`,
    whyUs: `"whyUs": { "text": string, ${CONFIDENCE_FIELD} }`,
    channels: `"channels": [{ "channel": string, "note": string, ${CONFIDENCE_FIELD} }]`,
    churnTriggers: '"churnTriggers": [string] (what makes this audience leave)',
    notOurUser: '"notOurUser": [string] (who this is explicitly not for)',
  },
  positioning: {
    category: '"category": string (the category we claim, in the buyer\'s words)',
    goal: '"goal": string (the one thing this company is trying to become)',
    promise: '"promise": string (what a customer gets, in one sentence)',
    activePosition:
      '"activePosition": string (the mental slot to own: the short phrase a reader should reach for when they think of this company)',
    statement:
      '"statement": string (the full sentence: for WHO, we are the WHAT that DOES, unlike ALTERNATIVE)',
    macroFrame: '"macroFrame": string (the shift in the world that makes this company matter now)',
    landscape: '"landscape": string (how the alternatives divide up, and where we sit among them)',
    coreClaims: '"coreClaims": [{ "claim": string }] (exactly three, each one the position rests on)',
    pillars:
      '"pillars": [{ "name": string, "oneLine": string, "carries": string (what this pillar is there to do for the position) }]',
    enemy:
      '"enemy": string (the behaviour or status quo we are against — a way of working, never a company)',
    archetype: '"archetype": string (the brand as a character, e.g. the Sage, the Outlaw)',
    essence: '"essence": string (two or three words: the feeling the brand leaves behind)',
    descriptorLadder:
      '"descriptorLadder": [{ "descriptor": string, "note": string (who this rung is for) }] (broad first, specific last; the row order is the ladder)',
    vocabularyReachFor: '"vocabularyReachFor": [{ "term": string, "note": string }]',
    vocabularyAvoid: '"vocabularyAvoid": [{ "term": string, "note": string }]',
    openRulings:
      '"openRulings": [{ "question": string }] (questions this workspace has not settled; never answer one)',
  },
  evidence: {
    facts:
      '"facts": [{ "fact": string, "source": string, "owner": string (whose desk it lives on), "lastConfirmedAt": "YYYY-MM-DD" }]',
    verifiedClaims:
      '"verifiedClaims": [{ "claim": string, "primarySource": string (the document or system that proves it), "sourceUrl": string, "sourceDate": "YYYY-MM-DD", "sampleOrMethod": string (how it was measured, and over what), "limits": string (what this claim may not be stretched to mean) }]',
  },
}

/** What the asset is, in one sentence, so the model knows what it is filling in. */
const ASSET_MEANING: Record<AssistAsset, string> = {
  workspace:
    'The workspace profile says who this deployment writes for and who it writes against. A competitor is a company a buyer would seriously consider instead of this one, not every company the site mentions.',
  icp: 'An audience (ICP) is not a persona blurb. It is a set of statements about a group of people, each carrying a confidence, and the confidence decides the grammar a writer may use for it.',
  positioning:
    'Positioning is the category this company claims, the slot it wants in a reader\'s head, and the words it claims them in. A workspace holds exactly one position at a time.',
  evidence:
    'The evidence bank is the only list of first-party facts a draft may state about this company. Proof travels with the claim: a row without a source, a method, and its limits is an assertion, and the writer cannot tell the difference.',
}

/** What this particular section is for, in the language of the framework. */
const SECTION_MEANING: Record<AssistAsset, Record<string, string>> = {
  workspace: {
    profile:
      'Take the company name and the notes from how the site describes itself. Propose a competitor only when the material names one or the notes do.',
  },
  icp: {
    who: 'WHO is one line an operator could read aloud in a meeting: the role, the company they are in, and the number they are judged on. Not demographics, and not a job description.',
    pains:
      'PAIN is evidenced. Every statement is something that hurts today, and its evidence names where you saw it — the page path, the interview, the quote. A pain you inferred from marketing copy is still an inference: say so in the note and set the confidence accordingly.',
    motivation:
      'MOTIVATION is why this person would act now rather than next year. It stays a hypothesis until somebody has validated it with a customer, so "hypothesis" is true unless the notes say it was checked.',
    solution:
      'HOW WE SOLVE IT is a mechanism, not a benefit: the thing the product actually does that removes the pain. "sampleLines" are phrasings that land, quoted from the site or the notes rather than written fresh.',
    competition:
      'THE COMPETITION is dated verbatims: what a rival actually claims, in their own words, with the date and the page you read it on. Never your summary of their strategy, and never a claim you cannot point at.',
    whyUs:
      'WHY US is the one sentence that explains choosing this over the alternative this audience already has, including doing nothing.',
    channels: 'WHERE THEY ARE lists places this audience already spends attention, not places we would like them to.',
    boundaries:
      'The boundaries are what keeps the rest of the record sharp: what makes this audience leave, and who this product is explicitly not for. Naming the non-user is the point of the section.',
    all: 'Fill in whatever the material supports and leave the rest empty. Pain is evidenced, motivation is a hypothesis until validated, and the competition is dated verbatims rather than your summary.',
  },
  positioning: {
    core: 'The active position is the mental slot to own — short enough that someone could repeat it back. The statement is the whole argument in one sentence, and the promise is what the customer gets, not what the product has.',
    frame:
      'The macro frame is the change in the world that makes this company worth existing now. The landscape says how the alternatives divide up and where this company sits, without naming anybody as an enemy.',
    coreClaims:
      'Exactly three claims, because a position with a dozen claims has no claims. Each is something this company can stand behind, not a feature.',
    pillars:
      'A pillar is a theme the position stands on, and "carries" says which job it does — trust, credibility, recognition. Two to four is a position; ten is a backlog.',
    identity:
      'The enemy is a behaviour or a status quo, never a named rival: naming a competitor on a customer surface picks a fight the reader did not ask to watch. The archetype and essence are how the brand behaves, not what it sells.',
    language:
      'The descriptor ladder runs broad to specific, so a writer can pick the rung the reader can hear. The vocabulary lists are the words this company reaches for and the words it will not use.',
    openRulings:
      'Open rulings are questions this workspace has not settled. The writer is told to take no position on them, so propose the question and never the answer.',
    all: 'Fill in whatever the material supports and leave the rest empty. The active position is the slot to own, the enemy is a behaviour rather than a company, and an open ruling is a question you do not answer.',
  },
  evidence: {
    facts:
      'A fact needs no hedging and no limits: a date, a name, a place, an architecture. Anything with a number that could move next quarter is a claim, not a fact, and belongs in the verified claims instead.',
    verifiedClaims:
      'You are proposing rows for a person to verify, never verified rows. Give the claim, where the proof would be found, how it was measured, and the limits it may not be stretched past. A softened version of an unsupported claim is still unsupported, so do not hedge a claim into the list.',
  },
}

/** The rules that hold for every section, plus the ones the section earns. */
function assistRules(asset: AssistAsset, keys: readonly string[]): string[] {
  const rules = [
    'Never invent facts. When the material does not say, leave the field empty rather than filling it with something plausible.',
    'When a statement comes from one of the pages below, name that page\'s path in the field that records where it came from.',
  ]
  const schema = KEY_SCHEMA[asset]
  if (keys.some((key) => schema[key]?.includes('"confidence"'))) {
    rules.push(
      'Every item carries a confidence, and the highest you may use is "inference": you are reading a company\'s own copy, not its customers.',
    )
  }
  if (asset === 'evidence') {
    rules.push(
      'Never set "ref", "verificationDepth", or "recheckAt" — a person assigns those when they check the row.',
      'Give "sourceUrl" only when that exact URL appears in the notes or on one of the pages below. Otherwise leave it empty.',
    )
  }
  return [...rules, 'Reply with only the JSON object. No prose, no code fences.']
}

/** Everything the assistant may read, resolved once by the server action. */
export interface AssistContext {
  profile: ResolvedWorkspaceProfile
  brandVoice: BrandVoiceContent | null
  /** Active audiences. The one being edited is excluded by the caller. */
  icps: IcpContent[]
  positioning: PositioningContent | null
  evidenceBank: EvidenceBankContent | null
  /** `YYYY-MM-DD`; what the evidence bank's expiry is judged against. */
  asOf: string
}

/**
 * The system prompt: what this section is, exactly which JSON keys to return,
 * and the four rules that keep a draft from becoming a finding.
 *
 * Built per `(asset, section)` in the style of `EXTRACTION_SYSTEM_PROMPT`, so
 * the model is never shown a key it must not fill in — the surest way to stop
 * it filling one in.
 */
function buildAssistSystem(input: AssistInput, keys: readonly string[]): string {
  const schema = KEY_SCHEMA[input.asset]
  const lines = keys.map((key) => `  ${schema[key]}`).join(',\n')
  const verb = input.mode === 'refine' ? 'revise' : 'draft'
  return [
    `You are the setup assistant for a marketing content workspace. You ${verb} one section of the workspace's own record of itself, from what the workspace has already written down.`,
    ASSET_MEANING[input.asset],
    SECTION_MEANING[input.asset][input.section],
    'Return ONE JSON object with exactly these keys and shapes (use "" or [] where the material is silent):',
    '{',
    lines,
    '}',
    ...assistRules(input.asset, keys),
  ].join('\n')
}

// ---------------------------------------------------------------------------
// The user prompt
// ---------------------------------------------------------------------------

/** One site page as the assistant sees it: what it is called, where it is, what it says. */
function sitePageBlock(page: { url: string; title: string | null; text: string }): string {
  const heading = page.title ? `### ${page.title}` : `### ${page.url}`
  return [heading, page.url, page.text.slice(0, ASSIST_PAGE_TEXT_CAP)].filter(Boolean).join('\n')
}

/**
 * The user prompt: the operator's notes, everything the workspace already
 * holds, the pages from its own site, and — when refining — the draft in front
 * of them.
 *
 * The "what we already know" half is rendered with the same functions the
 * generate stage uses, so the assistant and the writer are reading one
 * description of the workspace. Empty blocks are omitted rather than sent as
 * bare headings: a heading with nothing under it is an invitation to invent.
 */
function buildAssistUser(input: AssistInput, ctx: AssistContext): string {
  const sections: string[] = [`## Your notes\n${input.notes.trim() || '(none)'}`]

  const known = [
    workspaceProfileToPrompt(ctx.profile),
    ctx.brandVoice ? brandVoiceToPrompt(ctx.brandVoice) : '',
    ...ctx.icps.map((icp) => icpToPrompt(icp)),
    positioningToPrompt(ctx.positioning),
    evidenceBankToPrompt(ctx.evidenceBank, {
      asOf: ctx.asOf,
      surface: 'web',
      companyName: ctx.profile.companyName,
    }) ?? '',
  ].filter(Boolean)
  if (known.length > 0) sections.push(`## What we already know\n\n${known.join('\n\n')}`)

  if (ctx.profile.sitePages.length > 0) {
    const heading = ctx.profile.targetDomain
      ? `## Pages from ${ctx.profile.targetDomain}`
      : '## Pages from the company site'
    sections.push(`${heading}\n\n${ctx.profile.sitePages.map(sitePageBlock).join('\n\n')}`)
  }

  if (input.mode === 'refine') {
    sections.push(
      `## Current draft of this section\n${JSON.stringify(input.current ?? {}, null, 2)}\n\n` +
        'Revise it applying the notes; keep what the notes do not contradict.',
    )
  }

  return sections.join('\n\n')
}

export function buildAssistPrompt(
  input: AssistInput,
  ctx: AssistContext,
): { system: string; user: string } {
  const keys = assistSectionKeys(input.asset, input.section)
  return { system: buildAssistSystem(input, keys), user: buildAssistUser(input, ctx) }
}

// ---------------------------------------------------------------------------
// The reply
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>

const asRecord = (value: unknown): Loose =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * A bare array is the section it could only be.
 *
 * Models routinely answer `"pains"` with the list rather than the object
 * holding the list. When the section has exactly one key there is no ambiguity
 * about which one they meant, and refusing it would throw away a good reply
 * over its wrapper.
 */
function unwrapReply(json: unknown, keys: readonly string[]): Loose {
  if (Array.isArray(json) && keys.length === 1) return { [keys[0]]: json }
  return asRecord(json)
}

/** A URL survives only if the operator or the site actually wrote it down. */
function citedIn(url: string, sourceTexts: readonly string[]): boolean {
  if (!url) return false
  return sourceTexts.some((text) => typeof text === 'string' && text.includes(url))
}

/**
 * The workspace profile has no `parseXContent`: it is resolved from three
 * sources rather than parsed from one, so the assist path normalises the three
 * fields it may propose itself. `normaliseDomain` is the same function the
 * resolver uses, so a competitor the assistant proposes and one an operator
 * types end up identical.
 */
function parseWorkspaceReply(raw: Loose): { content: Loose; warnings: string[] } {
  const warnings: string[] = []
  const seen = new Set<string>()
  const competitors: { domain: string; name: string }[] = []
  for (const entry of Array.isArray(raw.competitors) ? raw.competitors : []) {
    const row = asRecord(entry)
    const domain = normaliseDomain(row.domain)
    if (!domain) {
      const named = asString(row.name) || asString(row.domain)
      if (named) warnings.push(`Dropped competitor "${named}": no usable domain`)
      continue
    }
    if (seen.has(domain)) continue
    seen.add(domain)
    competitors.push({ domain, name: asString(row.name) || domain })
  }
  return {
    content: {
      companyName: asString(raw.companyName),
      competitors,
      siteNotes: asString(raw.siteNotes),
    },
    warnings,
  }
}

/**
 * Evidence rows come back unverified, whatever the model claimed.
 *
 * The parser needs a ref to keep a row at all (a row nothing can cite is not a
 * row), so refs are lent for the parse and taken away afterwards: the global's
 * `assignEvidenceRefs` hook issues the real one when a person saves. The depth
 * is forced to `self_reported` and the re-check date cleared so the row shows
 * up as work still to do rather than as a checked claim, and a source URL
 * survives only when it appears verbatim in the material the model was given.
 */
function applyEvidenceRules(
  content: Loose,
  keys: readonly string[],
  sourceTexts: readonly string[],
): string[] {
  const warnings: string[] = []
  if (keys.includes('verifiedClaims') && Array.isArray(content.verifiedClaims)) {
    let dropped = 0
    content.verifiedClaims = content.verifiedClaims.map((row) => {
      const claim = asRecord(row)
      const sourceUrl = asString(claim.sourceUrl)
      if (sourceUrl && !citedIn(sourceUrl, sourceTexts)) dropped += 1
      return {
        ...claim,
        ref: '',
        verificationDepth: 'self_reported',
        recheckAt: '',
        sourceUrl: citedIn(sourceUrl, sourceTexts) ? sourceUrl : '',
      }
    })
    if (dropped > 0) {
      warnings.push(
        `Dropped ${dropped} source URL${dropped === 1 ? '' : 's'} that does not appear in your notes or the fetched pages`,
      )
    }
    warnings.push('Proposed claims are unverified: add the source and re-check date before using them')
  }
  if (keys.includes('facts') && Array.isArray(content.facts)) {
    content.facts = content.facts.map((row) => ({ ...asRecord(row), ref: '' }))
  }
  return warnings
}

/**
 * The reply, run through the asset's own parser and then through the rules
 * that apply only to a machine-written draft.
 *
 * One parser serves the admin form, a Payload document, and this, so a value
 * the assistant produces cannot be shaped differently from one a person typed.
 * Throws only for an unknown section — every other kind of bad reply comes back
 * as an empty-ish value plus warnings, because a model that answered the wrong
 * question must not take the operator's step down with it.
 */
export function parseAssistReply(
  asset: AssistAsset,
  section: string,
  json: unknown,
  opts: { sourceTexts?: readonly string[] } = {},
): { value: Record<string, unknown>; warnings: string[] } {
  const keys = assistSectionKeys(asset, section)
  const raw = unwrapReply(json, keys)
  const warnings: string[] = []
  if (!keys.some((key) => key in raw)) {
    warnings.push(`The reply contained none of the expected keys (${keys.join(', ')})`)
  }

  let content: Loose
  if (asset === 'workspace') {
    const parsed = parseWorkspaceReply(raw)
    content = parsed.content
    warnings.push(...parsed.warnings)
  } else if (asset === 'icp') {
    const parsed = parseIcpContent({ ...emptyIcpContent(), ...raw })
    warnings.push(...parsed.warnings)
    content = capAssistConfidence(parsed.content) as unknown as Loose
  } else if (asset === 'positioning') {
    const parsed = parsePositioningContent({ ...emptyPositioningContent(), ...raw })
    warnings.push(...parsed.warnings)
    content = parsed.content as unknown as Loose
    // A core claim's `evidenceRef` points at a bank entry the assistant cannot
    // see the ids of, so any it proposes is a citation nobody checked. The
    // operator links the claim to the evidence in the editor.
    if (Array.isArray(content.coreClaims)) {
      const proposed = content.coreClaims.filter((row) => asString(asRecord(row).evidenceRef)).length
      content.coreClaims = content.coreClaims.map((row) => ({ ...asRecord(row), evidenceRef: '' }))
      if (proposed > 0) {
        warnings.push(
          `Dropped ${proposed} evidence ref${proposed === 1 ? '' : 's'} the assistant proposed; link claims to the evidence bank yourself`,
        )
      }
    }
  } else {
    // Refs are lent so the parser keeps the rows, then removed below.
    const lend = (rows: unknown, prefix: string) =>
      (Array.isArray(rows) ? rows : []).map((row, index) => {
        const r = asRecord(row)
        return { ...r, ref: asString(r.ref) || `${prefix}${index + 1}` }
      })
    const parsed = parseEvidenceBankContent({
      verifiedClaims: lend(raw.verifiedClaims, 'E'),
      facts: lend(raw.facts, 'F'),
      rejectedClaims: [],
    })
    warnings.push(...parsed.warnings)
    content = parsed.content as unknown as Loose
  }

  const value = pickAssistSection(asset, section, content)
  if (asset === 'evidence') warnings.push(...applyEvidenceRules(value, keys, opts.sourceTexts ?? []))
  return { value, warnings }
}

/**
 * Everything the reply's `sourceUrl` claims are checked against: what the
 * operator typed, and what the fetched pages say and are addressed by.
 */
export function assistSourceTexts(notes: string, ctx: AssistContext): string[] {
  return [
    notes,
    ...ctx.profile.sitePages.map((page) => page.url),
    ...ctx.profile.sitePages.map((page) => page.text),
  ]
}
