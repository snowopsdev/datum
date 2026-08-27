import type { CollectionConfig } from 'payload'

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
