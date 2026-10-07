import type { CollectionConfig } from 'payload'

import { COMPANY_MENTIONS_OPTIONS, DEFAULT_COMPANY_MENTIONS } from '../lib/tenant/companyMentions'

export const Templates: CollectionConfig = {
  slug: 'templates',
  admin: {
    group: false,
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      // One line, in the reader's terms, for the brief's angle and the "I want
      // to make a…" picker: "a ranked list of the best options".
      name: 'intent',
      type: 'text',
      admin: { description: 'What this kind of piece is for, in one line. Shown when choosing a template and used as the brief\'s angle.' },
    },
    {
      // How much of the tenant's own pitch this kind of piece carries. The
      // positioning and the evidence bank reach every prompt, and without a
      // rule the writer reads "core claims (lean on these)" as licence to sell
      // in a how-to. The audience still shapes every piece; this decides only
      // whether the company itself appears.
      name: 'companyMentions',
      type: 'select',
      // Not `required`: a template saved before this field existed, or created
      // without it, reads as `mention` through `companyMentionsOf`.
      defaultValue: DEFAULT_COMPANY_MENTIONS,
      options: COMPANY_MENTIONS_OPTIONS.map(({ label, value }) => ({ label, value })),
      admin: {
        description:
          'How much the company itself may appear in pieces of this kind. The audience and positioning shape every piece either way.',
      },
    },
    {
      name: 'outline',
      type: 'richText',
    },
    {
      name: 'dos',
      type: 'array',
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'donts',
      type: 'array',
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'example',
      type: 'richText',
    },
    {
      name: 'requiredSections',
      type: 'array',
      admin: {
        description:
          'H2 headings every article using this template must contain. The outline is prose guidance; only these are enforced by the structural QA check.',
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'seoSpec',
      type: 'group',
      fields: [
        {
          name: 'titleTagMaxLength',
          type: 'number',
          defaultValue: 60,
        },
        {
          name: 'metaDescriptionMaxLength',
          type: 'number',
          defaultValue: 160,
        },
        {
          name: 'headingStructureRules',
          type: 'textarea',
        },
        {
          name: 'faqRequired',
          type: 'checkbox',
        },
        {
          name: 'faqMinQuestions',
          type: 'number',
        },
        {
          name: 'faqMaxQuestions',
          type: 'number',
        },
        {
          name: 'ogTagsRequired',
          type: 'checkbox',
          admin: {
            description:
              'Require a social title and description on every draft. The social image is never checked — the writer has no image to point at and there is no tenant default, so requiring one would fail every draft.',
          },
        },
      ],
    },
  ],
}
