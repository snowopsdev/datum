import type { CollectionConfig } from 'payload'

export const Templates: CollectionConfig = {
  slug: 'templates',
  admin: {
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
        },
      ],
    },
  ],
}
