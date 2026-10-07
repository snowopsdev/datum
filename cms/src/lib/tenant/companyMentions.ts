/**
 * How much the company itself may appear in a piece, set per template.
 *
 * Dependency-free like the rest of `lib/tenant/`: the Templates collection,
 * the template editor, and the pipeline's writer and reviewer prompts all read
 * this one definition.
 */

export type CompanyMentions = 'none' | 'mention' | 'feature'

export const DEFAULT_COMPANY_MENTIONS: CompanyMentions = 'mention'

export const COMPANY_MENTIONS_OPTIONS: readonly {
  value: CompanyMentions
  label: string
  hint: string
}[] = [
  {
    value: 'none',
    label: 'None: never name the company',
    hint: 'For pieces where any pitch reads as an intrusion, such as news or a how-to-watch guide.',
  },
  {
    value: 'mention',
    label: 'Mention: once at most, where it answers the reader',
    hint: 'One mention in the body, never in the title, meta fields, or FAQ.',
  },
  {
    value: 'feature',
    label: 'Feature: may recommend the company as an option',
    hint: 'For comparisons and ranked lists where the company is a real option. Every comparison still needs a source.',
  },
]

/** A template saved before the field existed, or with it cleared, reads as the default. */
export function companyMentionsOf(template: { companyMentions?: string | null }): CompanyMentions {
  const value = template.companyMentions
  return value === 'none' || value === 'mention' || value === 'feature'
    ? value
    : DEFAULT_COMPANY_MENTIONS
}
