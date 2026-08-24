import type { CollectionConfig } from 'payload'

import { auditArticleChange } from '../lib/articleAudit'

export const Articles: CollectionConfig = {
  slug: 'articles',
  hooks: {
    afterChange: [auditArticleChange],
  },
  admin: {
    group: false,
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'slug',
      type: 'text',
    },
    {
      name: 'keyword',
      type: 'text',
      required: true,
    },
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'templates',
    },
    {
      name: 'research',
      type: 'group',
      fields: [
        {
          name: 'rankingPagesSummary',
          type: 'textarea',
        },
        {
          name: 'commonSubtopics',
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
          name: 'relatedQuestions',
          type: 'array',
          fields: [
            {
              name: 'text',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: 'body',
      type: 'richText',
    },
    {
      name: 'titleTag',
      type: 'text',
    },
    {
      name: 'metaDescription',
      type: 'textarea',
    },
    {
      name: 'ogTitle',
      type: 'text',
    },
    {
      name: 'ogDescription',
      type: 'textarea',
    },
    {
      name: 'ogImage',
      type: 'text',
    },
    {
      name: 'faqItems',
      type: 'array',
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'answer',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'topic_selected',
      options: [
        'topic_selected',
        'researched',
        'drafted',
        'qa_passed',
        'needs_revision',
        'approved',
        'published',
      ],
    },
    {
      name: 'qaResults',
      type: 'group',
      fields: [
        {
          name: 'structural',
          type: 'group',
          fields: [
            {
              name: 'passed',
              type: 'checkbox',
            },
            {
              name: 'violations',
              type: 'json',
            },
          ],
        },
        {
          name: 'factCheck',
          type: 'group',
          fields: [
            {
              name: 'passed',
              type: 'checkbox',
            },
            {
              name: 'notes',
              type: 'textarea',
            },
            {
              name: 'sources',
              type: 'json',
            },
          ],
        },
        {
          name: 'qualitativeReview',
          type: 'group',
          fields: [
            {
              name: 'passed',
              type: 'checkbox',
            },
            {
              name: 'notes',
              type: 'textarea',
            },
          ],
        },
      ],
    },
    {
      name: 'generationModel',
      type: 'text',
    },
    {
      name: 'qaModels',
      type: 'json',
    },
    {
      name: 'totalCostUsd',
      type: 'number',
    },
    {
      name: 'reviewedBy',
      type: 'text',
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}
