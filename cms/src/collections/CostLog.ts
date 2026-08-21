import type { CollectionConfig } from 'payload'

export const CostLog: CollectionConfig = {
  slug: 'cost-log',
  admin: {
    useAsTitle: 'pipelineRunId',
  },
  timestamps: true,
  fields: [
    {
      name: 'pipelineRunId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
    },
    {
      name: 'stage',
      type: 'select',
      options: ['generate', 'factCheck', 'qualitativeReview'],
    },
    {
      name: 'provider',
      type: 'text',
    },
    {
      name: 'model',
      type: 'text',
    },
    {
      name: 'inputTokens',
      type: 'number',
    },
    {
      name: 'outputTokens',
      type: 'number',
    },
    {
      name: 'webSearchRequests',
      type: 'number',
    },
    {
      name: 'costUsd',
      type: 'number',
    },
  ],
}
