/**
 * The brief: what the editor sees between research and writing.
 *
 * This is the checkpoint that puts a human decision *before* the expensive
 * work. Until now the first chance to steer a piece came after research,
 * writing, QA and scoring had all been paid for. The brief is built the moment
 * research finishes, from things that already exist — the template's required
 * sections, the research gaps, the brand voice's audience — so it costs no
 * model call. The editor edits it, approves it, and only then does writing
 * start.
 *
 * Pure on purpose: no Payload, no LLM. `researchStage` calls it, tests call it.
 */

import type { BrandVoiceContent } from './brandVoice'
import type { Facet, InformationGap } from './informationGain/lib'
import { icpAudienceLine, type IcpContent } from './tenant'

export type BriefSectionSource = 'template' | 'research' | 'editor'

export interface BriefSection {
  heading: string
  notes: string
  source: BriefSectionSource
}

export interface BriefDraft {
  angle: string
  audience: string
  sections: BriefSection[]
  /** Facet labels the ranking pages agree on — the draft must cover these. */
  mustCover: string[]
  /** Gap labels — where the draft can say something the ranking pages do not. */
  opportunities: string[]
  notes: string
}

export interface BuildBriefInput {
  keyword: string
  /** The template's one-line purpose, e.g. "a ranked list of options". */
  templateIntent: string | null | undefined
  requiredSections: string[]
  facets: Facet[]
  gaps: InformationGap[]
  brandVoice: BrandVoiceContent | null
  /**
   * The audience this piece is for. It supersedes the brand voice's audience
   * description, which describes everyone the brand talks to; the brief needs
   * the one group this piece is aimed at. Null falls back to the voice.
   */
  icp: IcpContent | null
}

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Assemble the brief.
 *
 * Sections come from two places and are labelled so the editor knows which
 * they can drop: template sections are enforced by structural QA no matter what
 * the brief says, so removing one here only removes its *notes*; research
 * sections are suggestions built from the gaps the ranking pages leave, and
 * are the editor's to keep or cut.
 */
export function buildBrief(input: BuildBriefInput): BriefDraft {
  const intent = clean(input.templateIntent)
  const angle = intent ? `${intent} for "${input.keyword}"` : `An article about "${input.keyword}"`

  const voiceAudience = [
    clean(input.brandVoice?.audience.description),
    clean(input.brandVoice?.audience.needs) ? `Needs: ${clean(input.brandVoice?.audience.needs)}` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const audience = icpAudienceLine(input.icp) || voiceAudience

  const sections: BriefSection[] = [
    ...input.requiredSections
      .map(clean)
      .filter(Boolean)
      .map((heading) => ({ heading, notes: '', source: 'template' as const })),
    ...input.gaps
      .filter((gap) => clean(gap.label))
      .map((gap) => ({
        heading: clean(gap.label),
        notes: [clean(gap.description), clean(gap.evidenceHint) ? `Evidence: ${clean(gap.evidenceHint)}` : '']
          .filter(Boolean)
          .join(' '),
        source: 'research' as const,
      })),
  ]

  return {
    angle,
    audience,
    sections,
    mustCover: input.facets.map((f) => clean(f.label)).filter(Boolean),
    opportunities: input.gaps.map((g) => clean(g.label)).filter(Boolean),
    notes: '',
  }
}

/**
 * Read a stored brief back into a known shape. It lives in Payload group and
 * JSON fields, so an older row may hold nothing, or something half-formed.
 */
export function parseBrief(raw: unknown): BriefDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const sections: BriefSection[] = Array.isArray(b.sections)
    ? b.sections.flatMap((s) => {
        if (!s || typeof s !== 'object') return []
        const row = s as Record<string, unknown>
        const heading = clean(row.heading)
        if (!heading) return []
        const source = row.source
        return [
          {
            heading,
            notes: clean(row.notes),
            source:
              source === 'template' || source === 'research' || source === 'editor'
                ? source
                : ('editor' as const),
          },
        ]
      })
    : []
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(clean).filter(Boolean) : []
  return {
    angle: clean(b.angle),
    audience: clean(b.audience),
    sections,
    mustCover: strings(b.mustCover),
    opportunities: strings(b.opportunities),
    notes: clean(b.notes),
  }
}
