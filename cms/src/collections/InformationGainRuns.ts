import type { CollectionConfig } from 'payload'

const immutable = () => {
  throw new Error('Information-gain run entries are append-only')
}

/**
 * One immutable scoring result for one draft, written by the pipeline's
 * information-gain stage with `overrideAccess: true`. `Article.informationGain`
 * holds a small denormalised summary (decision, headline numbers, `scoredAt`)
 * of whichever run is current for that article; this collection holds the
 * full scorecard — every claim, its scores, and the policy that judged it —
 * so a reviewer or a later re-score can see exactly why a decision was made.
 *
 * All 0–1 signals under `scores`/`claims` are uncalibrated LLM estimates
 * (`calibrated` is always `false` until a real calibration pass exists).
 */
export const InformationGainRuns: CollectionConfig = {
  slug: 'information-gain-runs',
  admin: {
    group: false,
    useAsTitle: 'decision',
    defaultColumns: ['createdAt', 'article', 'decision', 'policyVersion'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [({ operation }) => (operation === 'update' ? immutable() : undefined)],
    beforeDelete: [immutable],
  },
  timestamps: true,
  fields: [
    {
      name: 'article',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
    },
    {
      name: 'pipelineRunId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'snapshot',
      type: 'relationship',
      relationTo: 'corpus-snapshots',
      // Stays an id at any query depth — see the same field on Articles.research.
      maxDepth: 0,
    },
    {
      name: 'policyVersion',
      type: 'text',
      required: true,
    },
    {
      name: 'policy',
      type: 'json',
      admin: {
        description: 'Resolved thresholds this run judged against, with a source per key.',
      },
    },
    {
      name: 'models',
      type: 'json',
    },
    {
      name: 'decision',
      type: 'select',
      required: true,
      index: true,
      options: ['PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK'],
    },
    {
      name: 'reasons',
      type: 'json',
      admin: {
        description: 'PolicyReason[] — why the decision landed where it did.',
      },
    },
    {
      name: 'baselineAvailable',
      type: 'checkbox',
    },
    {
      name: 'calibrated',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description:
          'Always false: every 0–1 signal in this record is an uncalibrated LLM estimate.',
      },
    },
    {
      name: 'scores',
      type: 'group',
      fields: [
        { name: 'consensusCoverage', type: 'number' },
        { name: 'potentialGainUnits', type: 'number' },
        { name: 'verifiedGainUnits', type: 'number' },
        { name: 'verificationRatio', type: 'number' },
        { name: 'verifiedGainDensity', type: 'number' },
        { name: 'facetGainCoverage', type: 'number' },
        { name: 'internalDuplicationRate', type: 'number' },
      ],
    },
    {
      name: 'claimSummary',
      type: 'group',
      fields: [
        { name: 'totalClaims', type: 'number' },
        { name: 'materiallyNovelClaims', type: 'number' },
        { name: 'verifiedNovelClaims', type: 'number' },
        { name: 'unsupportedNovelClaims', type: 'number' },
        { name: 'contradictoryClaims', type: 'number' },
        { name: 'firstPartyClaims', type: 'number' },
      ],
    },
    {
      name: 'claimIds',
      type: 'group',
      admin: {
        description:
          'The claim ids behind each DocumentScore classification, captured at scoring ' +
          'time under policyVersion — not re-derivable once the policy changes.',
      },
      fields: [
        {
          name: 'blocked',
          type: 'json',
          admin: { description: 'Claim ids behind scores.blockedClaimIds.' },
        },
        {
          name: 'review',
          type: 'json',
          admin: { description: 'Claim ids behind scores.reviewClaimIds.' },
        },
        {
          name: 'materiallyNovel',
          type: 'json',
          admin: { description: 'Claim ids behind scores.materiallyNovelClaimIds.' },
        },
        {
          name: 'verifiedNovel',
          type: 'json',
          admin: { description: 'Claim ids behind scores.verifiedNovelClaimIds.' },
        },
      ],
    },
    {
      name: 'claims',
      type: 'json',
      admin: {
        description: 'ClaimRecord[] — full per-claim signals, evidence, and scores.',
      },
    },
    {
      name: 'tokenCount',
      type: 'number',
    },
    {
      name: 'costUsd',
      type: 'number',
    },
    {
      name: 'draftUpdatedAt',
      type: 'date',
    },
  ],
}
