import type { CollectionConfig } from 'payload'

import { auditArticleChange } from '../lib/articleAudit'
import { emitArticleStatusEvent } from '../lib/articleEvents'
import { ARTICLE_STATUSES } from '../lib/articleStatusMeta'
import {
  gateReadOnlyStatus,
  gateReviewOverride,
  gateVerifiedStatus,
  invalidateStaleInformationGain,
} from '../lib/articleReviewGate'

export const Articles: CollectionConfig = {
  slug: 'articles',
  hooks: {
    // `invalidateStaleInformationGain` is first because it is a *dependency*:
    // it clears the decision an edited draft no longer deserves, and
    // `gateVerifiedStatus` has to see that clearance rather than the PASS it
    // replaced. `gateReadOnlyStatus` sits after it (readOnly statuses never
    // carry a decision, so order is documentation) and before the review gates
    // it has nothing in common with. The last two are ordered as documentation
    // only — `gateVerifiedStatus` re-derives the fresh-justification test
    // rather than trusting the hook before it.
    beforeChange: [
      invalidateStaleInformationGain,
      gateReadOnlyStatus,
      gateReviewOverride,
      gateVerifiedStatus,
    ],
    afterChange: [auditArticleChange, emitArticleStatusEvent],
  },
  admin: {
    group: false,
    useAsTitle: 'title',
  },
  fields: [
    {
      // Taking a topic off the board without destroying it. A hard delete is
      // impossible by design — `article-audit` rows are append-only and their
      // NOT NULL FK back to the article refuses to be nulled — and it would be
      // the wrong trade anyway: the trail of what was chosen and dropped is
      // exactly the sort of thing an audit log exists to keep.
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Hidden from the article board and skipped by every pipeline run.',
      },
    },
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
      admin: { description: 'The primary keyword this article targets.' },
    },
    {
      // Chosen by the operator in topic discovery, before research runs, so it
      // cannot live on `research.queryCluster` (which is derived afterwards).
      // These feed the query cluster and the generate prompt, which is how one
      // article ends up covering a group of related searches instead of the
      // group becoming a board item each.
      name: 'secondaryKeywords',
      type: 'array',
      labels: { singular: 'Secondary keyword', plural: 'Secondary keywords' },
      admin: {
        description:
          'Related searches grouped with the primary keyword. The article is written and scored to cover all of them.',
      },
      fields: [{ name: 'keyword', type: 'text', required: true }],
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
      // The checkpoint between research and writing. Built by the research
      // stage from things that already exist (template sections, research
      // gaps, the brand voice's audience), edited and approved by a person,
      // and only then does the generate stage run. `brief_review` is the
      // status that waits here; no pipeline stage has it as an entry status.
      name: 'brief',
      type: 'group',
      admin: {
        description:
          'What the piece will argue and cover, agreed before writing starts. Approving it is what queues the draft.',
      },
      fields: [
        { name: 'angle', type: 'text' },
        { name: 'audience', type: 'text' },
        {
          name: 'sections',
          type: 'array',
          fields: [
            { name: 'heading', type: 'text', required: true },
            { name: 'notes', type: 'textarea' },
            {
              // `template` rows are enforced by structural QA whatever the
              // brief says; `research` rows are suggestions from the gaps the
              // ranking pages leave; `editor` rows were added by a person.
              name: 'source',
              type: 'select',
              options: ['template', 'research', 'editor'],
            },
          ],
        },
        { name: 'mustCover', type: 'json' },
        { name: 'opportunities', type: 'json' },
        { name: 'notes', type: 'textarea' },
        { name: 'approvedAt', type: 'date' },
        { name: 'approvedBy', type: 'text' },
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
      // The shared table owns the list; a literal copy here is what the old
      // "keep these files aligned" convention existed to protect.
      options: [...ARTICLE_STATUSES],
      admin: {
        description:
          'verified = information-gain PASS (ready to approve). needs_review / blocked = a reviewer must override or send back.',
      },
    },
    {
      // Scheduled publishing: the publish-due job (jobs/publishDue.ts) moves
      // due approved articles to published through the normal update path.
      // The value survives status moves as inert intent; only `approved` is
      // ever picked up, so a stray date on a reviewed-back article does nothing.
      name: 'publishAt',
      type: 'date',
      index: true,
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
        condition: (data) => data?.status === 'approved',
        description: 'Publish automatically at this time. Leave blank to publish by hand.',
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
      name: 'informationGain',
      type: 'group',
      access: {
        // The scoring stage writes this with the Local API's default
        // `overrideAccess: true`, which skips field access entirely; every
        // other caller — the admin panel, REST, the ops server actions, which
        // all pass `overrideAccess: false` — is refused. Without this an editor
        // could hand-set `decision: 'PASS'` and then `status: 'verified'` in
        // two ordinary edits and skip scoring; `gateVerifiedStatus` owns the
        // other half of that, the status transition itself.
        update: () => false,
      },
      admin: {
        readOnly: true,
        description:
          'Written by the informationGain stage; the linked run holds the full scorecard. Read-only: a decision can only be earned by scoring.',
      },
      fields: [
        {
          name: 'run',
          type: 'relationship',
          relationTo: 'information-gain-runs',
          // Stays an id at any query depth — see the same field on research.snapshot.
          maxDepth: 0,
        },
        {
          name: 'decision',
          type: 'select',
          options: ['PASS', 'REVISE', 'HUMAN_REVIEW', 'BLOCK'],
        },
        {
          name: 'policyVersion',
          type: 'text',
        },
        {
          name: 'consensusCoverage',
          type: 'number',
        },
        {
          name: 'verifiedGainUnits',
          type: 'number',
        },
        {
          name: 'verificationRatio',
          type: 'number',
        },
        {
          name: 'internalDuplicationRate',
          type: 'number',
        },
        {
          name: 'verifiedNovelClaims',
          type: 'number',
        },
        {
          name: 'scoredAt',
          type: 'date',
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
