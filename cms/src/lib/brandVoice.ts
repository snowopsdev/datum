/**
 * Brand voice — shared, dependency-free helpers.
 *
 * Imported by both the CMS (admin view, extraction, seed) and the pipeline
 * (`pipeline/src/brandVoice.ts` re-exports it via a relative path), so this
 * file must stay free of `next`, `react`, `payload` runtime imports, `@/`
 * aliases, and `process.env`.
 */

export type LanguageLevel = 'plain' | 'general' | 'professional' | 'expert'

export const LANGUAGE_LEVELS: readonly LanguageLevel[] = ['plain', 'general', 'professional', 'expert']

export interface ToneDials {
  /** 1 = formal … 5 = casual */
  formality: number
  /** 1 = warm … 5 = neutral */
  warmth: number
  /** 1 = bold … 5 = careful */
  boldness: number
  /** 1 = enthusiastic … 5 = matter-of-fact */
  energy: number
}

export type ToneDialKey = keyof ToneDials

export const TONE_DIALS: readonly { key: ToneDialKey; label: string; low: string; high: string }[] = [
  { key: 'formality', label: 'Formality', low: 'Formal', high: 'Casual' },
  { key: 'warmth', label: 'Warmth', low: 'Warm', high: 'Neutral' },
  { key: 'boldness', label: 'Boldness', low: 'Bold', high: 'Careful' },
  { key: 'energy', label: 'Energy', low: 'Enthusiastic', high: 'Matter-of-fact' },
]

/**
 * The canonical brand voice shape. It is the onboarding form state, the
 * upload-extraction JSON schema, the prompt/guide renderer input, and the core
 * of the admin DTO. Payload docs are normalised into it with
 * `parseBrandVoiceContent`.
 */
export interface BrandVoiceContent {
  name: string
  essence: { oneLiner: string; mission: string }
  coreValues: { value: string; description: string }[]
  audience: {
    description: string
    languageLevel: LanguageLevel | null
    interests: string
    needs: string
  }
  persona: string
  voiceAdjectives: { adjective: string; description: string; doExample: string; dontExample: string }[]
  voiceInOwnWords: string
  notTraits: { trait: string; boundaryNote: string }[]
  tone: ToneDials
  preferredWords: { word: string; note: string }[]
  bannedWords: { word: string; note: string }[]
  samples: { title: string; text: string }[]
}

export const MAX_ADJECTIVES = 3
export const MAX_SAMPLES = 3
export const MAX_SAMPLE_CHARS = 1500
export const MIN_CORE_VALUES = 3
export const MAX_CORE_VALUES = 5
/** Words shorter than this hard-fail too easily on legitimate prose. */
export const SHORT_BANNED_WORD_LENGTH = 4

/** Every article field the generate stage produces — the voice governs all of them. */
export const GOVERNED_FIELDS = [
  'title',
  'titleTag',
  'metaDescription',
  'ogTitle',
  'ogDescription',
  'faqItems',
  'bodyMarkdown',
] as const

export function emptyBrandVoiceContent(name = ''): BrandVoiceContent {
  return {
    name,
    essence: { oneLiner: '', mission: '' },
    coreValues: [],
    audience: { description: '', languageLevel: null, interests: '', needs: '' },
    persona: '',
    voiceAdjectives: [],
    voiceInOwnWords: '',
    notTraits: [],
    tone: { formality: 3, warmth: 3, boldness: 3, energy: 3 },
    preferredWords: [],
    bannedWords: [],
    samples: [],
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

function clampDial(value: unknown, fallback = 3): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(5, Math.max(1, Math.round(n)))
}

function dedupeWords(rows: { word: string; note: string }[]): { word: string; note: string }[] {
  const seen = new Set<string>()
  const out: { word: string; note: string }[] = []
  for (const row of rows) {
    const key = row.word.toLowerCase()
    if (!row.word || seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/**
 * Coerce any loosely-shaped object (LLM extraction output, a Payload doc,
 * client form state) into a clean `BrandVoiceContent`, reporting what had to
 * be truncated or fixed. Never throws.
 */
export function parseBrandVoiceContent(input: unknown): {
  content: BrandVoiceContent
  warnings: string[]
} {
  const warnings: string[] = []
  const raw = asRecord(input)
  const essence = asRecord(raw.essence)
  const audience = asRecord(raw.audience)
  const tone = asRecord(raw.tone)

  const languageLevelRaw = asString(audience.languageLevel).toLowerCase()
  const languageLevel = (LANGUAGE_LEVELS as readonly string[]).includes(languageLevelRaw)
    ? (languageLevelRaw as LanguageLevel)
    : null
  if (languageLevelRaw && !languageLevel) {
    warnings.push(`Unknown language level "${languageLevelRaw}" ignored`)
  }

  const coreValues = asArray(raw.coreValues)
    .map((row) => {
      const r = asRecord(row)
      return { value: asString(r.value), description: asString(r.description) }
    })
    .filter((row) => row.value)

  let voiceAdjectives = asArray(raw.voiceAdjectives)
    .map((row) => {
      const r = asRecord(row)
      return {
        adjective: asString(r.adjective),
        description: asString(r.description),
        doExample: asString(r.doExample),
        dontExample: asString(r.dontExample),
      }
    })
    .filter((row) => row.adjective)
  if (voiceAdjectives.length > MAX_ADJECTIVES) {
    warnings.push(`Kept the first ${MAX_ADJECTIVES} of ${voiceAdjectives.length} adjectives`)
    voiceAdjectives = voiceAdjectives.slice(0, MAX_ADJECTIVES)
  }

  const notTraits = asArray(raw.notTraits)
    .map((row) => {
      const r = asRecord(row)
      return { trait: asString(r.trait), boundaryNote: asString(r.boundaryNote) }
    })
    .filter((row) => row.trait)

  const wordRows = (value: unknown) =>
    dedupeWords(
      asArray(value).map((row) => {
        const r = asRecord(row)
        return { word: asString(r.word), note: asString(r.note) }
      }),
    )

  let samples = asArray(raw.samples)
    .map((row) => {
      const r = asRecord(row)
      return { title: asString(r.title), text: asString(r.text) }
    })
    .filter((row) => row.text)
  if (samples.length > MAX_SAMPLES) {
    warnings.push(`Kept the first ${MAX_SAMPLES} of ${samples.length} writing samples`)
    samples = samples.slice(0, MAX_SAMPLES)
  }
  samples = samples.map((sample) => {
    if (sample.text.length <= MAX_SAMPLE_CHARS) return sample
    warnings.push(`Sample "${sample.title || sample.text.slice(0, 20)}…" truncated to ${MAX_SAMPLE_CHARS} characters`)
    return { ...sample, text: `${sample.text.slice(0, MAX_SAMPLE_CHARS).trimEnd()}…` }
  })

  const content: BrandVoiceContent = {
    name: asString(raw.name),
    essence: { oneLiner: asString(essence.oneLiner), mission: asString(essence.mission) },
    coreValues,
    audience: {
      description: asString(audience.description),
      languageLevel,
      interests: asString(audience.interests),
      needs: asString(audience.needs),
    },
    persona: asString(raw.persona),
    voiceAdjectives,
    voiceInOwnWords: asString(raw.voiceInOwnWords),
    notTraits,
    tone: {
      formality: clampDial(tone.formality),
      warmth: clampDial(tone.warmth),
      boldness: clampDial(tone.boldness),
      energy: clampDial(tone.energy),
    },
    preferredWords: wordRows(raw.preferredWords),
    bannedWords: wordRows(raw.bannedWords),
    samples,
  }
  return { content, warnings }
}

/** `parseBrandVoiceContent` without the warnings — for Payload docs already saved. */
export function brandVoiceContentOf(input: unknown): BrandVoiceContent {
  return parseBrandVoiceContent(input).content
}

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Lower-cased, de-duplicated tenant banned words for the structural QA scan. */
export function bannedWordsOf(bv: BrandVoiceContent): string[] {
  return [...new Set(bv.bannedWords.map((w) => w.word.trim().toLowerCase()).filter(Boolean))]
}

export function preferredWordsOf(bv: BrandVoiceContent): string[] {
  return [...new Set(bv.preferredWords.map((w) => w.word.trim()).filter(Boolean))]
}

export function notTraitsOf(bv: BrandVoiceContent): string[] {
  return bv.notTraits.map((t) => t.trait.trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Activation rules
// ---------------------------------------------------------------------------

/** Problems that block activation. Empty array means the record is complete enough to govern the pipeline. */
export function brandVoiceActivationProblems(bv: BrandVoiceContent): string[] {
  const problems: string[] = []
  if (!bv.name) problems.push('Give the brand voice a name')
  if (!bv.essence.oneLiner) problems.push('Add the brand essence one-liner (what you do and for whom)')
  const values = bv.coreValues.filter((v) => v.value)
  if (values.length < MIN_CORE_VALUES || values.length > MAX_CORE_VALUES) {
    problems.push(`List ${MIN_CORE_VALUES}–${MAX_CORE_VALUES} core values (currently ${values.length})`)
  }
  if (!bv.persona) problems.push('Describe the human persona')
  const adjectives = bv.voiceAdjectives.filter((a) => a.adjective)
  if (adjectives.length !== MAX_ADJECTIVES) {
    problems.push(`Pick exactly ${MAX_ADJECTIVES} adjectives (currently ${adjectives.length})`)
  }
  if (bv.notTraits.filter((t) => t.trait).length === 0) {
    problems.push('Add at least one "what we are NOT" trait')
  }
  for (const dial of TONE_DIALS) {
    const value = bv.tone[dial.key]
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      problems.push(`${dial.label} must be a whole number from 1 to 5`)
    }
  }
  return problems
}

/** Banned words likely to hard-fail legitimate prose because they are so short. */
export function shortBannedWords(bv: BrandVoiceContent): string[] {
  return bannedWordsOf(bv).filter((w) => w.length < SHORT_BANNED_WORD_LENGTH)
}

// ---------------------------------------------------------------------------
// Rendering — LLM prompt
// ---------------------------------------------------------------------------

function dialLine(bv: BrandVoiceContent, dial: (typeof TONE_DIALS)[number]): string {
  const value = bv.tone[dial.key]
  const lean =
    value <= 2 ? `leans ${dial.low.toLowerCase()}` : value >= 4 ? `leans ${dial.high.toLowerCase()}` : 'balanced'
  return `- ${dial.label}: ${value}/5 on ${dial.low} (1) ↔ ${dial.high} (5) — ${lean}`
}

const bullet = (text: string): string => `- ${text}`

/**
 * Deterministic markdown block for the generate system prompt and the QA
 * rubric. Contains no timestamps or ids so repeated runs produce identical
 * cost-log request snapshots. Sections with no content are omitted.
 */
export function brandVoiceToPrompt(bv: BrandVoiceContent): string {
  const sections: string[] = [
    `# Brand voice (tenant)`,
    `This brand voice applies to every field you produce: ${GOVERNED_FIELDS.join(', ')}. It layers on top of the platform style guide; where they overlap, the brand voice wins on tone and vocabulary.`,
  ]

  if (bv.essence.oneLiner || bv.essence.mission) {
    const lines = [`## Who we are`]
    if (bv.essence.oneLiner) lines.push(bv.essence.oneLiner)
    if (bv.essence.mission) lines.push(`Mission: ${bv.essence.mission}`)
    sections.push(lines.join('\n'))
  }

  if (bv.coreValues.length) {
    sections.push(
      [
        `## Core values (the voice must reflect these)`,
        ...bv.coreValues.map((v) => bullet(v.description ? `**${v.value}** — ${v.description}` : `**${v.value}**`)),
      ].join('\n'),
    )
  }

  const audienceLines: string[] = []
  if (bv.audience.description) audienceLines.push(bv.audience.description)
  if (bv.audience.languageLevel) {
    audienceLines.push(`Language level: ${bv.audience.languageLevel} — match it.`)
  }
  if (bv.audience.interests) audienceLines.push(`Interests: ${bv.audience.interests}`)
  if (bv.audience.needs) audienceLines.push(`Needs and pain points: ${bv.audience.needs}`)
  if (audienceLines.length) sections.push([`## Who we are talking to`, ...audienceLines].join('\n'))

  if (bv.persona) sections.push([`## Our brand as a person`, bv.persona].join('\n'))

  if (bv.voiceAdjectives.length) {
    sections.push(
      [
        `## How we sound`,
        ...bv.voiceAdjectives.map((a) => {
          const parts = [`**${a.adjective}**`]
          if (a.description) parts[0] += ` — ${a.description}`
          if (a.doExample) parts.push(`Do: "${a.doExample}"`)
          if (a.dontExample) parts.push(`Don't: "${a.dontExample}"`)
          return bullet(parts.join(' '))
        }),
      ].join('\n'),
    )
  }

  if (bv.voiceInOwnWords) sections.push([`## In our own words`, bv.voiceInOwnWords].join('\n'))

  if (bv.notTraits.length) {
    sections.push(
      [
        `## What we are NOT (hard boundaries)`,
        ...bv.notTraits.map((t) => bullet(t.boundaryNote ? `${t.trait} — ${t.boundaryNote}` : t.trait)),
      ].join('\n'),
    )
  }

  sections.push([`## Tone dials`, ...TONE_DIALS.map((dial) => dialLine(bv, dial))].join('\n'))

  const preferred = preferredWordsOf(bv)
  if (preferred.length) {
    sections.push(
      [
        `## Words we love`,
        ...bv.preferredWords.map((w) => bullet(w.note ? `${w.word} (${w.note})` : w.word)),
      ].join('\n'),
    )
  }

  const banned = bannedWordsOf(bv)
  if (banned.length) {
    sections.push(
      [
        `## Never use these words`,
        `A deterministic check rejects any output containing them: ${banned.join(', ')}.`,
      ].join('\n'),
    )
  }

  return sections.join('\n\n')
}

/** Few-shot block for the generate user prompt. `null` when the tenant supplied no samples. */
export function brandVoiceSamplesToPrompt(bv: BrandVoiceContent): string | null {
  if (!bv.samples.length) return null
  return [
    `# On-voice writing samples`,
    `Match the voice of these samples (not their topic):`,
    ...bv.samples.map((s, i) => `## Sample ${i + 1}${s.title ? `: ${s.title}` : ''}\n${s.text}`),
  ].join('\n\n')
}

// ---------------------------------------------------------------------------
// Rendering — human guide
// ---------------------------------------------------------------------------

export interface BrandVoiceGuideMeta {
  status?: string | null
  activatedAt?: string | null
  activatedBy?: string | null
}

function dialBar(value: number): string {
  return `${'●'.repeat(value)}${'○'.repeat(5 - value)}`
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\n+/g, ' ') || '—'

/**
 * Notion-template-style "Brand & Voice Guide" as markdown, for the Guide tab
 * and the export action. Every section renders (with a placeholder when
 * empty) so the document reads as a complete guide.
 */
export function brandVoiceToGuideMarkdown(bv: BrandVoiceContent, meta: BrandVoiceGuideMeta = {}): string {
  const none = '_Not defined yet._'
  const out: string[] = []

  out.push(`# ${bv.name || 'Untitled'} — Brand & Voice Guide`)
  out.push(bv.essence.oneLiner ? `> ${bv.essence.oneLiner}` : `> ${none}`)

  out.push(`## Mission`, bv.essence.mission || none)

  out.push(`## Core values`)
  if (bv.coreValues.length) {
    for (const v of bv.coreValues) {
      out.push(`### ${v.value}`, v.description || none)
    }
  } else {
    out.push(none)
  }

  out.push(`## Who we're talking to`)
  const aud = bv.audience
  if (aud.description || aud.languageLevel || aud.interests || aud.needs) {
    if (aud.description) out.push(aud.description)
    const facts: string[] = []
    if (aud.languageLevel) facts.push(`- **Language level:** ${aud.languageLevel}`)
    if (aud.interests) facts.push(`- **Interests:** ${aud.interests}`)
    if (aud.needs) facts.push(`- **Needs and pain points:** ${aud.needs}`)
    if (facts.length) out.push(facts.join('\n'))
  } else {
    out.push(none)
  }

  out.push(`## Our brand as a person`, bv.persona || none)

  out.push(`## How we sound`)
  if (bv.voiceAdjectives.length) {
    out.push(
      [
        `| Adjective | What it means | Do | Don't |`,
        `| --- | --- | --- | --- |`,
        ...bv.voiceAdjectives.map(
          (a) => `| **${cell(a.adjective)}** | ${cell(a.description)} | ${cell(a.doExample)} | ${cell(a.dontExample)} |`,
        ),
      ].join('\n'),
    )
  } else {
    out.push(none)
  }
  if (bv.voiceInOwnWords) out.push(`### In our own words`, bv.voiceInOwnWords)

  out.push(`## What we are not`)
  out.push(
    bv.notTraits.length
      ? bv.notTraits.map((t) => `- **${t.trait}**${t.boundaryNote ? ` — ${t.boundaryNote}` : ''}`).join('\n')
      : none,
  )

  out.push(`## Tone dials`)
  out.push(
    TONE_DIALS.map((d) => `- ${d.low} ${dialBar(bv.tone[d.key])} ${d.high} (${d.label} ${bv.tone[d.key]}/5)`).join(
      '\n',
    ),
  )

  out.push(`## Words we use`)
  out.push(
    bv.preferredWords.length
      ? bv.preferredWords.map((w) => `- **${w.word}**${w.note ? ` — ${w.note}` : ''}`).join('\n')
      : none,
  )

  out.push(`## Words we avoid`)
  out.push(
    bv.bannedWords.length
      ? bv.bannedWords.map((w) => `- ~~${w.word}~~${w.note ? ` — ${w.note}` : ''}`).join('\n')
      : none,
  )

  out.push(`## Writing samples`)
  if (bv.samples.length) {
    bv.samples.forEach((s, i) => {
      out.push(`### ${s.title || `Sample ${i + 1}`}`, s.text.split('\n').map((line) => `> ${line}`).join('\n'))
    })
  } else {
    out.push(none)
  }

  const footer: string[] = []
  if (meta.status) footer.push(`Status: ${meta.status}`)
  if (meta.activatedAt) footer.push(`Activated: ${meta.activatedAt}`)
  if (meta.activatedBy) footer.push(`by ${meta.activatedBy}`)
  if (footer.length) out.push(`---`, `_${footer.join(' · ')}_`)

  return out.join('\n\n')
}

/** Safe file-name slug for the exported guide. */
export function brandVoiceSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'brand-voice'
  )
}
