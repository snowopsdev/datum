import type { CollectionConfig } from 'payload'

const signedIn = ({ req }: { req: { user?: unknown } }) => Boolean(req.user)

export const PipelineRuns: CollectionConfig = {
  slug: 'pipeline-runs',
  labels: { singular: 'Pipeline run', plural: 'Pipeline runs' },
  admin: {
    group: false,
    hidden: true,
    useAsTitle: 'runId',
  },
  access: {
    read: signedIn,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'runId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'source',
      type: 'select',
      required: true,
      options: ['onboarding', 'admin', 'cli', 'selected'],
      admin: {
        description:
          'Where the run came from. `selected` runs the articles a person ticked on the board; `admin` discovers new content-gap topics first.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: ['queued', 'running', 'succeeded', 'failed'],
    },
    { name: 'mode', type: 'select', required: true, options: ['mock', 'live'] },
    { name: 'template', type: 'relationship', relationTo: 'templates', required: true },
    // `admin`/`onboarding` runs are capped at 5 because each one buys a fresh
    // topic. A `selected` run buys nothing new — it advances articles that are
    // already on the board — so the ceiling is only there to stop a runaway
    // select-all, and the DB column is plain numeric either way.
    { name: 'requestedCount', type: 'number', required: true, min: 1, max: 50 },
    { name: 'articles', type: 'relationship', relationTo: 'articles', hasMany: true },
    { name: 'configFingerprint', type: 'text', required: true, index: true },
    { name: 'configSnapshot', type: 'json', required: true },
    { name: 'finalStatuses', type: 'json' },
    { name: 'warnings', type: 'json' },
    { name: 'errorSummary', type: 'textarea' },
    { name: 'requestedBy', type: 'text', required: true },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
  ],
}
