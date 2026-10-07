/** Audience-grounded direction; a failed suggestion must never block research. */
import type { Article, Template } from '../../cms/src/payload-types'
import type { BrandVoiceContent } from './brandVoice'
import type { BriefAngleOption } from './brief'
import { completeJSONLogged } from './llm'
import { audienceToPrompt, companyMentionsBlock, secondaryKeywordsOf } from './generatePrompt'
import { companyMentionsOf, positioningToPrompt, type CompanyMentions, type IcpContent, type TenantContext } from './tenant'
import type { StageContext } from './stages'

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
export function buildBriefAnglePrompt(input: BriefAngleInput): {system: string; user: string} {
  return {
    system: 'Propose one to three editorial angles, each at most 200 characters, grounded in the supplied audience pains and research gaps. Return JSON only: {"angles":[{"angle":string,"rationale":string,"pain":string|null,"gaps":string[]}]}. Use pain statements verbatim and only supplied gap labels. An angle resting on a [hypothesis] or [inference] pain must say so in its rationale. Respect the company-mentions rule. An angle is direction, not prose; invent no facts.',
    user: [
      `Keyword: ${input.keyword}\nSecondary keywords: ${input.secondaryKeywords.join(', ')}\nTemplate: ${input.templateName}\nIntent: ${input.templateIntent ?? ''}`,
      audienceToPrompt(input.brandVoice, input.icp),
      positioningToPrompt(input.tenant.positioning),
      input.facets.length ? `# Facets\n${input.facets.map(f => `- ${f.label}: ${f.description}`).join('\n')}` : '',
      input.gaps.length ? `# Gaps\n${input.gaps.map(g => `- ${g.label}: ${g.description}`).join('\n')}` : '',
      companyMentionsBlock(input.companyMentions, input.tenant),
    ].filter(Boolean).join('\n\n'),
  }
}
export function parseBriefAngles(json: unknown, allowed: {pains: string[]; gapLabels: string[]}): BriefAngleOption[] {
  if (!json || typeof json !== 'object' || !('angles' in json) || !Array.isArray(json.angles)) return []
  return json.angles.flatMap((raw: unknown): BriefAngleOption[] => {
    if (!raw || typeof raw !== 'object') return []
    const r = raw as Record<string, unknown>
    if (typeof r.angle !== 'string' || !r.angle.trim() || r.angle.trim().length > 200 || typeof r.rationale !== 'string' || !r.rationale.trim() || !Array.isArray(r.gaps)) return []
    const pain = r.pain === null ? null : typeof r.pain === 'string' && r.pain.trim() ? allowed.pains.find(p => p.toLowerCase().startsWith((r.pain as string).trim().toLowerCase())) : undefined
    if (pain === undefined || r.gaps.some(g => typeof g !== 'string' || !allowed.gapLabels.includes(g))) return []
    return [{angle: r.angle.trim(), rationale: r.rationale.trim(), pain, gaps: [...new Set(r.gaps as string[])]}]
  }).slice(0, 3)
}
export async function proposeBriefAngles(ctx: StageContext, article: Article, template: Template, icp: IcpContent | null, facets: Labelled[], gaps: Labelled[]): Promise<{options: BriefAngleOption[]; warning?: string}> {
  try {
    const result = await completeJSONLogged(ctx, 'briefAngle', article.id, buildBriefAnglePrompt({keyword: article.keyword, secondaryKeywords: secondaryKeywordsOf(article), templateName: template.name, templateIntent: template.intent, brandVoice: ctx.brandVoice, icp, facets, gaps, tenant: ctx.tenant, companyMentions: companyMentionsOf(template)}))
    const options = parseBriefAngles(result.json, {pains: icp?.pains.map(p => p.statement) ?? [], gapLabels: gaps.map(g => g.label)})
    return options.length ? {options} : {options: [], warning: 'brief angle: no valid angles returned'}
  } catch (error) {
    return {options: [], warning: `brief angle: ${error instanceof Error ? error.message : 'suggestion failed'}`}
  }
}
