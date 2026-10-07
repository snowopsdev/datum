/**
 * Brief angles: one cheap call during research that proposes up to three
 * directions for the piece, each tied to an audience pain and the research
 * gaps it fills.
 *
 * The angle is the cheapest place to steer a piece — the editor approves it
 * before any writing is paid for — and the template's own angle ("a ranked list
 * for X") ignores everything the workspace knows. A failed or unusable proposal
 * never blocks research: the template angle is always the last option, and the
 * failure comes back as a stage warning.
 */

import type { Article, Template } from '../../cms/src/payload-types'

import type { BrandVoiceContent } from './brandVoice'
import type { BriefAngleOption } from './brief'
import { audienceToPrompt, companyMentionsBlock, secondaryKeywordsOf } from './generatePrompt'
import { completeJSONLogged, CostLogWriteError } from './llm'
import type { StageContext } from './stages'
import {
  type CompanyMentions,
  companyMentionsOf,
  type IcpContent,
  positioningToPrompt,
  type TenantContext,
} from './tenant'

type Labelled = { label: string; description: string }

export interface BriefAngleInput {
  keyword: string
  secondaryKeywords: string[]
  templateName: string
  templateIntent: string | null | undefined
  brandVoice: BrandVoiceContent | null
  icp: IcpContent | null
  facets: Labelled[]
  gaps: Labelled[]
  tenant: TenantContext
  companyMentions: CompanyMentions
}

const MAX_ANGLE_CHARS = 200
const MAX_ANGLES = 3

/**
 * The angle prompt. It gets what decides a direction — the audience, the
 * positioning, the research, the company-mentions rule — and not the evidence
 * bank or the voice samples: an angle is a direction, not prose.
 */
export function buildBriefAnglePrompt(input: BriefAngleInput): { system: string; user: string } {
  return {
    system:
      'Propose one to three editorial angles, each at most 200 characters, grounded in the supplied audience pains and research gaps. Return JSON only: {"angles":[{"angle":string,"rationale":string,"pain":string|null,"gaps":string[]}]}. Copy each pain statement exactly as written, without its confidence tag, and use only supplied gap labels. An angle resting on a [hypothesis] or [inference] pain must say so in its rationale. Respect the company-mentions rule. An angle is direction, not prose; invent no facts.',
    user: [
      `Keyword: ${input.keyword}\nSecondary keywords: ${input.secondaryKeywords.join(', ')}\nTemplate: ${input.templateName}\nIntent: ${input.templateIntent ?? ''}`,
      audienceToPrompt(input.brandVoice, input.icp),
      positioningToPrompt(input.tenant.positioning),
      input.facets.length
        ? `# Facets\n${input.facets.map((f) => `- ${f.label}: ${f.description}`).join('\n')}`
        : '',
      input.gaps.length
        ? `# Gaps\n${input.gaps.map((g) => `- ${g.label}: ${g.description}`).join('\n')}`
        : '',
      companyMentionsBlock(input.companyMentions, input.tenant),
    ]
      .filter(Boolean)
      .join('\n\n'),
  }
}

/**
 * A pain statement reduced to its words. The prompt renders each pain with a
 * full stop and a confidence tag ("Wasting beans. [hypothesis]"), so a model
 * that copies it verbatim copies both; quotes and spacing drift too.
 */
const painKey = (text: string): string =>
  text
    .replace(/\[[^\]]*\]\s*$/, '')
    .replace(/^["'“”‘’\s]+|["'“”‘’\s.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()

/**
 * Read a model reply into angle options. Never throws.
 *
 * An option survives only if its angle fits the length limit, it names a pain
 * the audience actually has (the same statement, not a fragment of one) or
 * null, every gap it claims to fill is one research found, and it rests on at
 * least one of the two. The pain comes
 * back as the stored statement, so the brief shows the audience's own words.
 */
export function parseBriefAngles(
  json: unknown,
  allowed: { pains: string[]; gapLabels: string[] },
): BriefAngleOption[] {
  if (!json || typeof json !== 'object' || !('angles' in json) || !Array.isArray(json.angles)) {
    return []
  }
  const pains = new Map(allowed.pains.map((pain) => [painKey(pain), pain]))
  return (json.angles as unknown[])
    .flatMap((raw): BriefAngleOption[] => {
      if (!raw || typeof raw !== 'object') return []
      const row = raw as Record<string, unknown>
      const angle = typeof row.angle === 'string' ? row.angle.trim() : ''
      const rationale = typeof row.rationale === 'string' ? row.rationale.trim() : ''
      if (!angle || angle.length > MAX_ANGLE_CHARS || !rationale || !Array.isArray(row.gaps)) {
        return []
      }
      const pain =
        row.pain === null
          ? null
          : typeof row.pain === 'string'
            ? pains.get(painKey(row.pain))
            : undefined
      if (pain === undefined) return []
      const gaps = row.gaps as unknown[]
      if (gaps.some((gap) => typeof gap !== 'string' || !allowed.gapLabels.includes(gap))) return []
      // Grounded in at least one thing the workspace or the research knows;
      // otherwise it would outrank the template angle on nothing at all.
      if (pain === null && gaps.length === 0) return []
      return [{ angle, rationale, pain, gaps: [...new Set(gaps as string[])] }]
    })
    .slice(0, MAX_ANGLES)
}

/**
 * Propose angles for one article. Returns no options and a warning, rather than
 * throwing, when the model call fails or nothing in the reply survives parsing.
 * A failed cost-log write is the exception and propagates (`CostLogWriteError`).
 */
export async function proposeBriefAngles(
  ctx: StageContext,
  article: Article,
  template: Template,
  icp: IcpContent | null,
  facets: Labelled[],
  gaps: Labelled[],
): Promise<{ options: BriefAngleOption[]; warning?: string }> {
  try {
    const result = await completeJSONLogged(
      ctx,
      'briefAngle',
      article.id,
      buildBriefAnglePrompt({
        keyword: article.keyword,
        secondaryKeywords: secondaryKeywordsOf(article),
        templateName: template.name,
        templateIntent: template.intent,
        brandVoice: ctx.brandVoice,
        icp,
        facets,
        gaps,
        tenant: ctx.tenant,
        companyMentions: companyMentionsOf(template),
      }),
    )
    const options = parseBriefAngles(result.json, {
      pains: icp?.pains.map((pain) => pain.statement) ?? [],
      gapLabels: gaps.map((gap) => gap.label),
    })
    return options.length > 0
      ? { options }
      : { options: [], warning: 'brief angle: no valid angles returned' }
  } catch (error) {
    // A failed proposal falls back to the template angle; a failed cost row
    // does not, because the call was paid for and nothing recorded it.
    if (error instanceof CostLogWriteError) throw error
    return {
      options: [],
      warning: `brief angle: ${error instanceof Error ? error.message : 'suggestion failed'}`,
    }
  }
}
