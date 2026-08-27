import type { CollectionConfig } from 'payload'

/**
 * Cached Ahrefs keyword lookups, one row per (seed, country).
 *
 * Every discovery search spends Ahrefs API units, and the results barely move
 * week to week — so re-running the same seed because somebody switched screens
 * and came back is pure waste. This is the same reuse bargain the corpus
 * snapshots make, at a different granularity: keep the answer, serve it again,
 * and let the operator force a refresh when they actually want fresh numbers.
 *
 * Written by the discovery server action with `overrideAccess: true`; the admin
 * API cannot write it, because nothing here is a human decision.
 */
export const TopicSearches: CollectionConfig = {
  slug: 'topic-searches',
  admin: {
    group: false,
    useAsTitle: 'seed',
    defaultColumns: ['seed', 'country', 'resultCount', 'fetchedAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  timestamps: true,
  fields: [
    {
      name: 'seed',
      type: 'text',
      required: true,
      admin: { description: 'The subject the operator typed, as they typed it.' },
    },
    {
      // Lower-cased and whitespace-collapsed, so "  NFL Games " and "nfl games"
      // hit the same cached row instead of paying twice for one question.
      name: 'seedKey',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: { description: 'Keyword metrics are per-market, so the cache key includes it.' },
    },
    { name: 'fetchedAt', type: 'date', required: true, index: true },
    {
      name: 'resultCount',
      type: 'number',
      admin: { description: 'How many keywords the lookup returned.' },
    },
    {
      name: 'candidates',
      type: 'json',
      admin: { description: 'DiscoveredKeyword[] exactly as Ahrefs returned it, already ranked.' },
    },
  ],
}
