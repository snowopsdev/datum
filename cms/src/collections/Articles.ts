import type { CollectionConfig } from 'payload'

import { auditArticleChange } from '../lib/articleAudit'
import { gateReviewOverride } from '../lib/articleReviewGate'

export const Articles: CollectionConfig = {
  slug: 'articles',
  hooks: {
    beforeChange: [gateReviewOverride],
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
        {
          name: 'snapshot',
          type: 'relationship',
          relationTo: 'corpus-snapshots',
          // Stays an id at any query depth: a snapshot carries every crawled
          // page's text, and the pipeline's per-stage `find` would otherwise
          // drag the whole corpus into memory for every article it loads.
          // Load it explicitly when the baseline is actually needed.
          maxDepth: 0,
          admin: {
            description: 'Written by the research stage; see docs/information-gain.md.',
          },
        },
        {
          name: 'queryCluster',
          type: 'json',
          admin: {
            description: 'Written by the research stage; see docs/information-gain.md.',
          },
        },
        {
          name: 'facets',
          type: 'json',
          admin: {
            description: 'Written by the research stage; see docs/information-gain.md.',
          },
        },
        {
          name: 'gaps',
          type: 'json',
          admin: {
            description: 'Written by the research stage; see docs/information-gain.md.',
          },
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
        'verified',
        'needs_review',
        'blocked',
        'needs_revision',
        'approved',
        'published',
      ],
      admin: {
        description:
          'verified = information-gain PASS (ready to approve). needs_review / blocked = a reviewer must override or send back.',
      },
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
            {
              name: 'voiceScore',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'Brand voice fit 1–5 from the qualitative review. Informational only.' },
            },
            {
              name: 'voiceNotes',
              type: 'textarea',
            },
            {
              name: 'notTraitViolations',
              type: 'json',
              admin: {
                description:
                  'Clear breaches of a "what we are NOT" trait ({trait, excerpt, explanation}[]). Any entry fails QA.',
              },
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
      name: 'reviewJustification',
      type: 'textarea',
      admin: {
        description: 'Required to move a needs_review or blocked article to verified. Recorded in the audit trail.',
      },
    },
    {
      name: 'revisionNotes',
      type: 'textarea',
      admin: {
        description:
          'Reasons from the last information-gain run or reviewer; injected into the next generate prompt.',
      },
    },
    {
      name: 'revisionCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Times this article was sent back for regeneration. Informational.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
    },
  ],
}
