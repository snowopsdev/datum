/**
 * Positioning — the category we claim, the slot we occupy in a reader's head,
 * and the words we claim them in.
 *
 * The audience says who we write for; this says what we are to them. It is one
 * global rather than a collection because a workspace holds exactly one
 * position at a time: two live positions is the failure this asset exists to
 * prevent.
 *
 * Unlike the workspace profile and the audiences, positioning never gates a
 * run. A half-filled position still improves every prompt — the renderer omits
 * whatever is empty — so readiness reports it as a recommendation and the
 * pipeline injects whatever exists.
 *
 * Dependency-free like the rest of `lib/tenant/`: the global's hooks, the
 * readiness evaluator, and the pipeline prompts all import it.
 */

export type OpenRulingStatus = 'open' | 'ruled'

export const OPEN_RULING_STATUSES: readonly OpenRulingStatus[] = ['open', 'ruled']

/** A claim we lean on, optionally pointing at the evidence-bank entry that backs it. */
export interface PositioningClaim {
  claim: string
  /** An evidence-bank ref such as `E4`. Stored without brackets; rendered with them. */
  evidenceRef: string
}

export interface PositioningPillar {
  name: string
  oneLine: string
  /** What this pillar is there to carry: the jobs it does for the position. */
  carries: string
}

/** One rung of the broad → specific ladder. Row order is the ladder. */
export interface PositioningDescriptor {
  descriptor: string
  /** An operator's note about when to use this rung; never sent to the writer. */
  note: string
}

export interface PositioningTerm {
  term: string
  note: string
}

/**
 * A question the workspace has not settled. Open ones are sent to the writer
 * as "take no position on this", which is the whole reason the row exists.
 */
export interface PositioningRuling {
  question: string
  status: OpenRulingStatus
  ruling: string
  ruledAt: string
}

/**
 * The canonical positioning shape: the admin document, the loader's output,
 * and the prompt renderer's input.
 *
 * `notes` is deliberately absent. §1.5 makes the global's notes field an input
 * for the setup assistant only, and the surest way to keep an operator's
 * scratch text out of every prompt is for the renderer's input type not to
 * carry it at all.
 */
export interface PositioningContent {
  category: string
  goal: string
  promise: string
  activePosition: string
  statement: string
  macroFrame: string
  landscape: string
  coreClaims: PositioningClaim[]
  pillars: PositioningPillar[]
  enemy: string
  archetype: string
  essence: string
  descriptorLadder: PositioningDescriptor[]
  vocabularyReachFor: PositioningTerm[]
  vocabularyAvoid: PositioningTerm[]
  openRulings: PositioningRuling[]
}

export function emptyPositioningContent(): PositioningContent {
  return {
    category: '',
    goal: '',
    promise: '',
    activePosition: '',
    statement: '',
    macroFrame: '',
    landscape: '',
    coreClaims: [],
    pillars: [],
    enemy: '',
    archetype: '',
    essence: '',
    descriptorLadder: [],
    vocabularyReachFor: [],
    vocabularyAvoid: [],
    openRulings: [],
  }
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

type Loose = Record<string, unknown>

const asRecord = (value: unknown): Loose =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose) : {}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const rulingStatusOf = (value: unknown): OpenRulingStatus =>
  asString(value) === 'ruled' ? 'ruled' : 'open'

/** `[E4]`, `e4`, and `E4` all name the same entry; the bank stores the bare ref. */
const evidenceRefOf = (value: unknown): string => {
  const raw = asString(value).replace(/^\[|\]$/g, '').trim()
  return /^[EFR]\d+$/i.test(raw) ? raw.toUpperCase() : raw
}

/**
 * Coerce a Payload document, a form state, or assistant output into clean
 * `PositioningContent`, saying what had to be dropped. Never throws: this runs
 * inside admin hooks and a loader, where a thrown parser would surface as a
 * validation error about the wrong field.
 */
export function parsePositioningContent(input: unknown): {
  content: PositioningContent
  warnings: string[]
} {
  const warnings: string[] = []
  const raw = asRecord(input)
  const content = emptyPositioningContent()

  content.category = asString(raw.category)
  content.goal = asString(raw.goal)
  content.promise = asString(raw.promise)
  content.activePosition = asString(raw.activePosition)
  content.statement = asString(raw.statement)
  content.macroFrame = asString(raw.macroFrame)
  content.landscape = asString(raw.landscape)
  content.enemy = asString(raw.enemy)
  content.archetype = asString(raw.archetype)
  content.essence = asString(raw.essence)

  content.coreClaims = asArray(raw.coreClaims)
    .map((row) => {
      const r = asRecord(row)
      return { claim: asString(r.claim), evidenceRef: evidenceRefOf(r.evidenceRef) }
    })
    .filter((row) => {
      if (row.claim) return true
      if (row.evidenceRef) warnings.push('Dropped a core claim with an evidence ref but no claim')
      return false
    })

  content.pillars = asArray(raw.pillars)
    .map((row) => {
      const r = asRecord(row)
      return { name: asString(r.name), oneLine: asString(r.oneLine), carries: asString(r.carries) }
    })
    .filter((row) => {
      if (row.name) return true
      if (row.oneLine || row.carries) warnings.push('Dropped a pillar with no name')
      return false
    })

  content.descriptorLadder = asArray(raw.descriptorLadder)
    .map((row) => {
      const r = asRecord(row)
      return { descriptor: asString(r.descriptor), note: asString(r.note) }
    })
    .filter((row) => Boolean(row.descriptor))

  // The whole sentence rather than a noun to interpolate: "a reach-for" and
  // "an avoid" take different articles, and a warning is copy an operator reads.
  const terms = (value: unknown, dropped: string): PositioningTerm[] =>
    asArray(value)
      .map((row) => {
        const r = asRecord(row)
        return { term: asString(r.term), note: asString(r.note) }
      })
      .filter((row) => {
        if (row.term) return true
        if (row.note) warnings.push(dropped)
        return false
      })

  content.vocabularyReachFor = terms(
    raw.vocabularyReachFor,
    'Dropped a reach-for vocabulary entry with a note but no term',
  )
  content.vocabularyAvoid = terms(
    raw.vocabularyAvoid,
    'Dropped an avoid vocabulary entry with a note but no term',
  )

  content.openRulings = asArray(raw.openRulings)
    .map((row) => {
      const r = asRecord(row)
      return {
        question: asString(r.question),
        status: rulingStatusOf(r.status),
        ruling: asString(r.ruling),
        ruledAt: asString(r.ruledAt),
      }
    })
    .filter((row) => {
      if (row.question) return true
      if (row.ruling) warnings.push('Dropped a ruling with no question')
      return false
    })

  return { content, warnings }
}

export function positioningContentOf(input: unknown): PositioningContent {
  return parsePositioningContent(input).content
}

// ---------------------------------------------------------------------------
// Completeness
// ---------------------------------------------------------------------------

/**
 * What is still missing from a finished position.
 *
 * Nothing here blocks a run: the list is a nudge on the setup hub, and the
 * prompt renderer is happy with any subset. Three core claims exactly, because
 * a position with a dozen claims has no claims — the discipline is the point,
 * and a workspace that wants more should sharpen instead of adding.
 */
export function positioningCompletenessProblems(content: PositioningContent): string[] {
  const problems: string[] = []
  if (!content.category) problems.push('Name the category')
  if (!content.goal) problems.push('State the one goal')
  if (!content.promise) problems.push('Write the customer promise')
  if (!content.activePosition) problems.push('Name the position to own')
  if (!content.statement) problems.push('Write the positioning statement')
  const claims = content.coreClaims.filter((row) => row.claim).length
  if (claims !== 3) problems.push(`Write exactly three core claims (there ${claims === 1 ? 'is' : 'are'} ${claims})`)
  if (content.pillars.length === 0) problems.push('Add at least one pillar')
  return problems
}

export type PositioningStatus = 'missing' | 'partial' | 'ready'

/**
 * `missing` means nobody has saved anything, and only then is the block left
 * out of prompts entirely. Anything saved is worth sending, so `partial` is
 * injected exactly like `ready` — the difference is what the setup hub says,
 * not what the writer sees.
 */
export function positioningStatus(
  content: PositioningContent | null | undefined,
): PositioningStatus {
  if (!content) return 'missing'
  const empty =
    !content.category &&
    !content.goal &&
    !content.promise &&
    !content.activePosition &&
    !content.statement &&
    !content.macroFrame &&
    !content.landscape &&
    !content.enemy &&
    !content.archetype &&
    !content.essence &&
    content.coreClaims.length === 0 &&
    content.pillars.length === 0 &&
    content.descriptorLadder.length === 0 &&
    content.vocabularyReachFor.length === 0 &&
    content.vocabularyAvoid.length === 0 &&
    content.openRulings.length === 0
  if (empty) return 'missing'
  return positioningCompletenessProblems(content).length === 0 ? 'ready' : 'partial'
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

/** `term (note)`, or just the term when nobody annotated it. */
const term = (row: PositioningTerm): string => (row.note ? `${row.term} (${row.note})` : row.term)

/**
 * The `# Positioning` block for the generate system prompt and the qualitative
 * review.
 *
 * Deterministic and empty-section-free, for the same two reasons as the
 * audience block: two runs of an unchanged workspace must produce identical
 * cost-log request snapshots, and a heading with nothing under it teaches the
 * model that inventing something there is expected. Returns '' when the
 * workspace has saved no positioning at all.
 */
export function positioningToPrompt(content: PositioningContent | null | undefined): string {
  if (!content || positioningStatus(content) === 'missing') return ''

  const head: string[] = []
  const categoryGoal = [
    content.category ? `Category: ${sentence(content.category)}` : '',
    content.goal ? `Goal: ${sentence(content.goal)}` : '',
  ].filter(Boolean)
  if (categoryGoal.length > 0) head.push(categoryGoal.join(' '))
  if (content.promise) head.push(`Promise: ${sentence(content.promise)}`)
  if (content.activePosition) head.push(`Position we occupy: "${content.activePosition}".`)
  if (content.statement) head.push(`Statement: ${sentence(content.statement)}`)
  const frame = [
    content.macroFrame ? `Macro frame: ${sentence(content.macroFrame)}` : '',
    content.landscape ? `Landscape: ${sentence(content.landscape)}` : '',
  ].filter(Boolean)
  if (frame.length > 0) head.push(frame.join('   '))

  const sections: string[] = [['# Positioning', ...head].join('\n')]

  if (content.coreClaims.length > 0) {
    const rows = content.coreClaims.map(
      (row, index) =>
        `${index + 1}. ${sentence(row.claim)}${row.evidenceRef ? ` (see [${row.evidenceRef}])` : ''}`,
    )
    sections.push(
      `## Core claims (lean on these; cite the Evidence bank where a ref is given)\n${rows.join('\n')}`,
    )
  }

  if (content.pillars.length > 0) {
    const rows = content.pillars.map(
      (row) =>
        `- ${row.name}${row.oneLine ? ` — ${row.oneLine}` : ''}${
          row.carries ? ` — carries: ${row.carries}` : ''
        }`,
    )
    sections.push(`## Pillars\n${rows.join('\n')}`)
  }

  if (content.enemy) sections.push(`## Enemy\n${sentence(content.enemy)}`)

  const identity = [
    content.archetype ? `Archetype: ${sentence(content.archetype)}` : '',
    content.essence ? `Essence: ${sentence(content.essence)}` : '',
  ].filter(Boolean)
  if (identity.length > 0) sections.push(`## Archetype and essence\n${identity.join(' ')}`)

  if (content.descriptorLadder.length > 0) {
    // The operator's per-rung notes stay out: they are guidance about when to
    // use a rung, and the ladder itself is what the writer needs.
    sections.push(
      `## How to describe us (broad → specific)\n${content.descriptorLadder
        .map((row) => row.descriptor)
        .join(' → ')}`,
    )
  }

  const vocabulary = [
    content.vocabularyReachFor.length > 0
      ? `Reach for: ${content.vocabularyReachFor.map(term).join(', ')}.`
      : '',
    content.vocabularyAvoid.length > 0
      ? `Avoid: ${content.vocabularyAvoid.map(term).join(', ')}.`
      : '',
  ].filter(Boolean)
  if (vocabulary.length > 0) sections.push(`## Vocabulary\n${vocabulary.join(' ')}`)

  // Only the open ones. A ruled question is settled, and the heading's whole
  // instruction — take no position — is wrong for a decision the workspace has
  // already made; the ruling belongs in whichever field it settled.
  const open = content.openRulings.filter((row) => row.status === 'open')
  if (open.length > 0) {
    sections.push(
      `## Open rulings (take no position on these)\n${open
        .map((row) => `- ${row.question} (open)`)
        .join('\n')}`,
    )
  }

  return sections.join('\n')
}
