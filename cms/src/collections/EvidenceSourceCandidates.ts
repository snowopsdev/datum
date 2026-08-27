import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

import { CANDIDATE_CLASSES, normaliseDomain } from '../lib/informationGain'

/**
 * Domains the information-gain stage ran into that nobody has rated yet.
 *
 * Written by the scoring stage (`pipeline/src/informationGain/candidates.ts`)
 * with `overrideAccess: true`, one row per normalised domain, from two places:
 * a citation the verifier produced whose domain matched no active
 * `evidence-sources` rule, and a page ranking in the article's SERP snapshot.
 * The point is that an unrated domain is capped at `UNKNOWN_DOMAIN_CAP` and so
 * can never clear a novel-claim floor — this table is what turns "the pipeline
 * quietly blocked something" into a queue somebody can work through.
 *
 * `status` is the one human-owned field; everything else is derived and is
 * overwritten on the next sighting. A row is never the authority on whether a
 * domain is *rated* — `evidence-sources` is — so the review page re-checks each
 * pending row against the live rules rather than trusting `status`. That is
 * what makes a hand-created rule, or a deactivated one, take effect here with
 * no write and no cross-collection hook.
 */
export const EvidenceSourceCandidates: CollectionConfig = {
  slug: 'evidence-source-candidates',
  admin: {
    group: false,
    useAsTitle: 'domain',
    defaultColumns: ['domain', 'status', 'suggestedClass', 'citationCount', 'lastSeenAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.domain === 'string') {
          const d = normaliseDomain(data.domain)
          // APIError, not Error: matches EvidenceSources, so a bad row surfaces
          // as a field validation message rather than a 500.
          if (!d) throw new APIError('domain is required', 400)
          data.domain = d
        }
        return data
      },
    ],
  },
  timestamps: true,
  fields: [
    {
      name: 'domain',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Hostname without scheme or path, normalised the same way as evidence sources.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'pending',
      options: ['pending', 'approved', 'dismissed'],
      admin: {
        description:
          'pending = waiting for someone to rate it. approved = an evidence-sources row was created from it. dismissed = deliberately left unrated; it stays dismissed however often it turns up again.',
      },
    },
    {
      name: 'suggestedClass',
      type: 'select',
      required: true,
      options: [...CANDIDATE_CLASSES],
      admin: {
        description:
          'The dropdown default on the review page, not a decision. Never first_party_dataset (only a human can certify a source as ours) and never blocked (a suggestion should not default to shutting a domain out).',
      },
    },
    {
      name: 'citationCount',
      type: 'number',
      admin: { description: 'How many times the verifier has cited this domain, across all runs.' },
    },
    {
      name: 'serpCount',
      type: 'number',
      admin: { description: 'How many scored articles had this domain ranking for their keyword.' },
    },
    {
      name: 'domainRating',
      type: 'number',
      admin: { description: "Ahrefs domain rating, most recent one seen. Popularity, not accuracy." },
    },
    { name: 'firstSeenAt', type: 'date' },
    { name: 'lastSeenAt', type: 'date', index: true },
    {
      name: 'sightings',
      type: 'json',
      admin: {
        description:
          'CandidateSighting[] — the most recent times this domain turned up, newest first and capped at MAX_CANDIDATE_SIGHTINGS.',
      },
    },
    {
      name: 'resolvedSource',
      type: 'relationship',
      relationTo: 'evidence-sources',
      maxDepth: 0,
      admin: { description: 'The rule created when this candidate was approved.' },
    },
    { name: 'resolvedAt', type: 'date' },
    {
      name: 'resolvedBy',
      type: 'text',
      admin: { description: 'Who approved or dismissed it.' },
    },
  ],
}
