/**
 * ICPs — who a piece is written for.
 *
 * An ICP is not a persona blurb. It is a set of statements about a group of
 * people, each carrying a confidence, and the confidence is what decides the
 * grammar the writer may use for it: a `verified` pain is stated, a
 * `hypothesis` motivation is attributed to us. That is why every section here
 * renders its tag alongside the text, and why the legend is emitted with the
 * block rather than left to the model to infer.
 *
 * Dependency-free like the rest of `lib/tenant/`: the collection hooks, the
 * readiness evaluator, the brief, and the pipeline prompts all import it.
 */

import {
  CONFIDENCE_LEGEND,
  type Confidence,
  confidenceOf,
  confidenceTag,
} from './confidence'

export type IcpStatus = 'draft' | 'active' | 'archived'

export const ICP_STATUSES: readonly IcpStatus[] = ['draft', 'active', 'archived']

/** Where a pain statement came from: a URL, an interview id, a quote. */
export interface IcpEvidenceRef {
  ref: string
  note: string
}

export interface IcpPain {
  statement: string
  evidence: IcpEvidenceRef[]
  confidence: Confidence | null
}

export interface IcpMotivation {
  text: string
  /** Marked in the heading, because an unmarked guess reads as a finding. */
  hypothesis: boolean
  confidence: Confidence | null
}

export interface IcpSolution {
  mechanism: string
  /** Lines that land — phrasings the writer may reuse verbatim. */
  sampleLines: string[]
  confidence: Confidence | null
}

export interface IcpCompetitionRow {
  competitor: string
  claim: string
  /** When they were seen claiming it; a claim without a date ages invisibly. */
  claimedAt: string
  source: string
  confidence: Confidence | null
}

export interface IcpWhyUs {
  text: string
  confidence: Confidence | null
}

export interface IcpChannel {
  channel: string
  note: string
  confidence: Confidence | null
}

/**
 * The canonical ICP shape: the admin document, the loader's output, and the
 * prompt renderer's input. `id` is carried because `selectIcp` matches an
 * article's relationship against it and the research stage backfills it.
 */
export interface IcpContent {
  id: number | string | null
  name: string
  status: IcpStatus
  primary: boolean
  /** WHO, one line. */
  who: string
  pains: IcpPain[]
  motivation: IcpMotivation
  solution: IcpSolution
  competition: IcpCompetitionRow[]
  whyUs: IcpWhyUs
  channels: IcpChannel[]
  churnTriggers: string[]
  notOurUser: string[]
}

export function emptyIcpContent(name = ''): IcpContent {
  return {
    id: null,
    name,
    status: 'draft',
    primary: false,
    who: '',
    pains: [],
    motivation: { text: '', hypothesis: false, confidence: null },
    solution: { mechanism: '', sampleLines: [], confidence: null },
    competition: [],
    whyUs: { text: '', confidence: null },
    channels: [],
    churnTriggers: [],
    notOurUser: [],
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

/** `[{ text: 'x' }]` and `['x']` both mean the same list; the admin writes the first. */
const textRows = (value: unknown): string[] =>
  asArray(value)
    .map((row) => (typeof row === 'string' ? row.trim() : asString(asRecord(row).text)))
    .filter(Boolean)

const idOf = (value: unknown): number | string | null =>
  typeof value === 'number' || (typeof value === 'string' && value.trim()) ? value : null

const statusOf = (value: unknown): IcpStatus => {
  const raw = asString(value)
  return (ICP_STATUSES as readonly string[]).includes(raw) ? (raw as IcpStatus) : 'draft'
}

/**
 * Coerce a Payload document, a form state, or LLM output into a clean
 * `IcpContent`, saying what had to be dropped. Never throws: this runs inside a
 * `beforeChange` hook where a thrown parser would look like a validation error
 * about the wrong field.
 */
export function parseIcpContent(input: unknown): { content: IcpContent; warnings: string[] } {
  const warnings: string[] = []
  const raw = asRecord(input)
  const content = emptyIcpContent(asString(raw.name))
  content.id = idOf(raw.id)
  content.status = statusOf(raw.status)
  content.primary = raw.primary === true
  content.who = asString(raw.who)

  const confidence = (value: unknown, where: string): Confidence | null => {
    const parsed = confidenceOf(value)
    if (!parsed && asString(value)) warnings.push(`Unknown confidence "${asString(value)}" in ${where} ignored`)
    return parsed
  }

  content.pains = asArray(raw.pains)
    .map((row) => {
      const r = asRecord(row)
      return {
        statement: asString(r.statement),
        evidence: asArray(r.evidence)
          .map((e) => {
            const er = asRecord(e)
            return { ref: asString(er.ref), note: asString(er.note) }
          })
          .filter((e) => e.ref || e.note),
        confidence: confidence(r.confidence, 'a pain'),
      }
    })
    .filter((pain) => {
      if (pain.statement) return true
      if (pain.evidence.length > 0) warnings.push('Dropped a pain with evidence but no statement')
      return false
    })

  const motivation = asRecord(raw.motivation)
  content.motivation = {
    text: asString(motivation.text),
    hypothesis: motivation.hypothesis === true,
    confidence: confidence(motivation.confidence, 'the motivation'),
  }

  const solution = asRecord(raw.solution)
  content.solution = {
    mechanism: asString(solution.mechanism),
    sampleLines: textRows(solution.sampleLines),
    confidence: confidence(solution.confidence, 'the solution'),
  }

  content.competition = asArray(raw.competition)
    .map((row) => {
      const r = asRecord(row)
      return {
        competitor: asString(r.competitor),
        claim: asString(r.claim),
        claimedAt: asString(r.claimedAt),
        source: asString(r.source),
        confidence: confidence(r.confidence, 'a competition row'),
      }
    })
    .filter((row) => {
      if (row.competitor) return true
      if (row.claim) warnings.push('Dropped a competition row with a claim but no competitor')
      return false
    })

  const whyUs = asRecord(raw.whyUs)
  content.whyUs = {
    text: asString(whyUs.text),
    confidence: confidence(whyUs.confidence, 'why us'),
  }

  content.channels = asArray(raw.channels)
    .map((row) => {
      const r = asRecord(row)
      return {
        channel: asString(r.channel),
        note: asString(r.note),
        confidence: confidence(r.confidence, 'a channel'),
      }
    })
    .filter((row) => row.channel)

  content.churnTriggers = textRows(raw.churnTriggers)
  content.notOurUser = textRows(raw.notOurUser)

  return { content, warnings }
}

export function icpContentOf(input: unknown): IcpContent {
  return parseIcpContent(input).content
}

// ---------------------------------------------------------------------------
// Activation rules
// ---------------------------------------------------------------------------

/**
 * What blocks activation. Deliberately short: an ICP that names who they are,
 * one thing that hurts, and how we fix it is enough to write against. Every
 * other section sharpens the prompt but is omitted when empty, so demanding it
 * would gate a run on work that changes nothing about correctness.
 */
export function icpCompletenessProblems(icp: IcpContent): string[] {
  const problems: string[] = []
  if (!icp.name) problems.push('Give the audience a name')
  if (!icp.who) problems.push('Describe who they are in one line')
  if (icp.pains.filter((pain) => pain.statement).length === 0) {
    problems.push('Add at least one pain statement')
  }
  if (!icp.solution.mechanism) problems.push('Say how we solve it (the mechanism)')
  return problems
}

/**
 * Downgrade anything the assistant proposed as fact.
 *
 * A model drafting an ICP from site copy has no interviews and no data, so
 * every level it picks above `inference` is a claim about the world that
 * nobody checked. Capping on the way in means the operator raises a confidence
 * deliberately, and never discovers later that a "verified" pain was a guess.
 */
export function capAssistConfidence(content: IcpContent): IcpContent {
  const cap = (value: Confidence | null): Confidence | null =>
    value === 'verified' || value === 'strong_directional' ? 'inference' : value
  return {
    ...content,
    pains: content.pains.map((pain) => ({ ...pain, confidence: cap(pain.confidence) })),
    motivation: { ...content.motivation, confidence: cap(content.motivation.confidence) },
    solution: { ...content.solution, confidence: cap(content.solution.confidence) },
    competition: content.competition.map((row) => ({ ...row, confidence: cap(row.confidence) })),
    whyUs: { ...content.whyUs, confidence: cap(content.whyUs.confidence) },
    channels: content.channels.map((row) => ({ ...row, confidence: cap(row.confidence) })),
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** ` [strong directional]`, or '' when nobody said how sure they were. */
const tag = (confidence: Confidence | null): string =>
  confidence ? ` ${confidenceTag(confidence)}` : ''

/** A stored date is an ISO timestamp; the month is the useful part of "when". */
function claimedMonth(claimedAt: string): string {
  const match = /^(\d{4}-\d{2})/.exec(claimedAt)
  return match ? match[1] : ''
}

const sentence = (text: string): string => (/[.!?]$/.test(text) ? text : `${text}.`)

/**
 * The `# Audience` block for the generate system prompt and the qualitative
 * review.
 *
 * Deterministic — no ids, no timestamps beyond the operator's own `claimedAt`
 * — so two runs of the same workspace produce byte-identical cost-log request
 * snapshots. Empty sections are omitted entirely rather than sent as bare
 * headings, because a heading with nothing under it teaches the model that
 * making something up there is expected. Returns '' when there is no ICP worth
 * describing at all.
 */
export function icpToPrompt(
  icp: IcpContent | null | undefined,
  opts: { primary?: boolean } = {},
): string {
  if (!icp || !icp.name) return ''
  const primary = opts.primary ?? icp.primary
  // The legend sits directly under the heading, not as its own section: it is
  // the reading instruction for everything below, not a section of its own.
  const sections: string[] = [
    `# Audience: ${icp.name}${primary ? ' (primary ICP)' : ''}\n${CONFIDENCE_LEGEND}`,
  ]

  if (icp.who) sections.push(`## Who\n${icp.who}`)

  const pains = icp.pains.filter((pain) => pain.statement)
  if (pains.length > 0) {
    const bullets = pains.map((pain) => {
      const evidence = pain.evidence
        .map((row) => (row.note ? `${row.ref} (${row.note})`.trim() : row.ref))
        .filter(Boolean)
        .join('; ')
      return `- ${sentence(pain.statement)}${tag(pain.confidence)}${
        evidence ? ` (evidence: ${evidence})` : ''
      }`
    })
    sections.push(`## Pain\n${bullets.join('\n')}`)
  }

  if (icp.motivation.text) {
    const heading = icp.motivation.hypothesis ? '## Motivation (hypothesis)' : '## Motivation'
    sections.push(`${heading}\n${sentence(icp.motivation.text)}${tag(icp.motivation.confidence)}`)
  }

  if (icp.solution.mechanism || icp.solution.sampleLines.length > 0) {
    const lines: string[] = ['## How we solve it']
    if (icp.solution.mechanism) {
      lines.push(`Mechanism: ${sentence(icp.solution.mechanism)}${tag(icp.solution.confidence)}`)
    }
    if (icp.solution.sampleLines.length > 0) {
      lines.push(`Lines that land: ${icp.solution.sampleLines.map((l) => `"${l}"`).join(' / ')}`)
    }
    sections.push(lines.join('\n'))
  }

  if (icp.competition.length > 0) {
    const bullets = icp.competition.map((row) => {
      const month = claimedMonth(row.claimedAt)
      const where = [month ? `claimed ${month}` : '', row.source].filter(Boolean).join(', ')
      return `- ${row.competitor}${row.claim ? ` — "${row.claim}"` : ''}${
        where ? ` (${where})` : ''
      }${tag(row.confidence)}`
    })
    sections.push(`## The competition (what they claim, and when)\n${bullets.join('\n')}`)
  }

  if (icp.whyUs.text) {
    sections.push(`## Why us\n${sentence(icp.whyUs.text)}${tag(icp.whyUs.confidence)}`)
  }

  if (icp.channels.length > 0) {
    const bullets = icp.channels.map(
      (row) => `- ${row.channel}${row.note ? ` (${row.note})` : ''}${tag(row.confidence)}`,
    )
    sections.push(`## Where they are\n${bullets.join('\n')}`)
  }

  const boundaries = [...icp.notOurUser, ...icp.churnTriggers]
  if (boundaries.length > 0) {
    sections.push(
      `## Not our user / churn triggers\n${boundaries.map((text) => `- ${text}`).join('\n')}`,
    )
  }

  return sections.join('\n\n')
}

/**
 * The brief's one-line audience. The brief is a human artefact — the editor
 * reads it, edits it, approves it — so it gets the sentence, not the block.
 */
export function icpAudienceLine(icp: IcpContent | null | undefined): string {
  if (!icp) return ''
  const who = icp.who.trim()
  const pain = icp.pains.find((row) => row.statement)?.statement.trim() ?? ''
  if (!who && !pain) return ''
  if (!pain) return who
  if (!who) return `Main pain: ${sentence(pain)}`
  return `${sentence(who)} Main pain: ${sentence(pain)}`
}
