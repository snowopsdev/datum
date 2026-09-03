import type { GlobalConfig } from 'payload'

import { auditGlobalChange } from '../lib/governanceAudit'

/**
 * The Master Positioning framework, as one editable record.
 *
 * Each field's description teaches the framework in a line, because this is the
 * asset an operator is least likely to have written down anywhere: the words
 * are the work, and a blank textarea labelled "Essence" helps nobody. Nothing
 * here blocks a run — a half-filled position still sharpens every prompt, and
 * the renderer omits whatever is empty.
 */
export const Positioning: GlobalConfig = {
  slug: 'positioning',
  label: 'Positioning',
  admin: {
    group: false,
    description:
      'What this company is to the reader: the category it competes in, the slot it wants to own, and the words it claims them in. ' +
      'Recommended, not required — anything you fill in reaches the writer and the reviewer; anything you leave blank is simply left out.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [auditGlobalChange('positioning', 'positioning')],
  },
  fields: [
    {
      name: 'category',
      type: 'text',
      admin: {
        description:
          'What kind of company this is, in the words a buyer would use. The frame everything else is judged inside.',
      },
    },
    {
      name: 'goal',
      type: 'text',
      admin: {
        description: 'The one thing this positioning is for. One goal, not a list.',
      },
    },
    {
      name: 'promise',
      type: 'textarea',
      admin: {
        description:
          'What the customer gets, stated as a promise you would be embarrassed to break.',
      },
    },
    {
      name: 'activePosition',
      type: 'text',
      admin: {
        description:
          'The mental slot to own: the short phrase you want to be the answer to, in the reader’s head, before they think of anyone else.',
      },
    },
    {
      name: 'statement',
      type: 'textarea',
      admin: {
        description:
          'The full statement: for <who> who <need>, <company> is the <category> that <benefit>, unlike <alternative>.',
      },
    },
    {
      name: 'macroFrame',
      type: 'textarea',
      admin: {
        description:
          'The bigger shift this rides on — what is changing in the world that makes the position true now.',
      },
    },
    {
      name: 'landscape',
      type: 'textarea',
      admin: {
        description:
          'How the market is arranged around you: the groups of alternatives and what each stands for.',
      },
    },
    {
      name: 'coreClaims',
      type: 'array',
      admin: {
        description:
          'Exactly three claims the position rests on. Three, because a position with a dozen claims has none.',
      },
      fields: [
        { name: 'claim', type: 'text', required: true },
        {
          name: 'evidenceRef',
          type: 'text',
          admin: {
            description:
              'Optional: the evidence-bank entry that backs it, e.g. E4. The writer is told to cite it.',
          },
        },
      ],
    },
    {
      name: 'pillars',
      type: 'array',
      admin: {
        description:
          'The few themes every piece of communication stands on. Each one should carry a job the position needs done.',
      },
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'oneLine',
          type: 'text',
          admin: { description: 'The pillar in one line, as you would say it out loud.' },
        },
        {
          name: 'carries',
          type: 'textarea',
          admin: { description: 'What this pillar is there to carry: trust, price defence, urgency.' },
        },
      ],
    },
    {
      name: 'enemy',
      type: 'textarea',
      admin: {
        description:
          'What the customer is fighting — a habit, a cost, a way of working. Never a named rival on a customer surface: naming one advertises them and dates the copy.',
      },
    },
    {
      name: 'archetype',
      type: 'text',
      admin: {
        description: 'The character the brand plays, e.g. the Sage, the Outlaw, the Caregiver.',
      },
    },
    {
      name: 'essence',
      type: 'text',
      admin: { description: 'Two or three words for how it should feel to deal with you.' },
    },
    {
      name: 'descriptorLadder',
      type: 'array',
      admin: {
        description:
          'How to describe the company, broad to specific — the row order is the ladder. Start where a stranger can follow, end where a buyer can choose.',
      },
      fields: [
        { name: 'descriptor', type: 'text', required: true },
        {
          name: 'note',
          type: 'text',
          admin: { description: 'When to use this rung. For your team; never sent to the writer.' },
        },
      ],
    },
    {
      name: 'vocabularyReachFor',
      type: 'array',
      admin: { description: 'Words that carry the position. The writer is told to reach for these.' },
      fields: [
        { name: 'term', type: 'text', required: true },
        { name: 'note', type: 'text', admin: { description: 'Why this word, in a few words.' } },
      ],
    },
    {
      name: 'vocabularyAvoid',
      type: 'array',
      admin: {
        description:
          'Words that blur the position. Advisory only: the reviewer notes them, nothing fails on them. Words that must never appear belong in the brand voice’s banned list, which is checked structurally.',
      },
      fields: [
        { name: 'term', type: 'text', required: true },
        { name: 'note', type: 'text', admin: { description: 'Why to avoid it, in a few words.' } },
      ],
    },
    {
      name: 'openRulings',
      type: 'array',
      admin: {
        description:
          'Questions the company has not settled. Open ones are sent to the writer as “take no position on this”, which is what stops a draft deciding them by accident.',
      },
      fields: [
        { name: 'question', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          defaultValue: 'open',
          options: ['open', 'ruled'],
          admin: { description: 'Ruled questions leave the writer’s prompt; the ruling is yours to apply.' },
        },
        { name: 'ruling', type: 'textarea' },
        { name: 'ruledAt', type: 'date' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description:
          'Anything the setup assistant should know while drafting this. Never sent to the writer.',
      },
    },
  ],
}
