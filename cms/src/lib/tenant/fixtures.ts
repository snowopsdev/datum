import type { WorkspaceProfileDoc } from './workspaceProfile'
import type { EvidenceBankContent } from './evidenceBank'
import type { IcpContent } from './icp'
import type { PositioningContent } from './positioning'

/**
 * The demo workspace: the same imagined company as `BRAND_VOICE_FIXTURE`, so
 * "start with the demo workspace" produces one coherent tenant rather than a
 * voice for one business and audiences for another.
 *
 * Used by `npm run seed -- --with-brand-voice`, by `activateDefaultTenantAction`
 * on the first-run screen, and by the tenant tests. Editable and replaceable:
 * nothing here is special-cased anywhere.
 */
export const WORKSPACE_PROFILE_FIXTURE: WorkspaceProfileDoc = {
  companyName: 'Datum',
  targetDomain: 'datum.example.com',
  competitors: [
    { domain: 'competitor-one.com', name: 'Competitor One' },
    { domain: 'competitor-two.com', name: 'Competitor Two' },
  ],
  siteNotes:
    'A governed content pipeline for small B2B software teams: research, a brief a person approves, then a draft that is checked and scored before anyone sees it.',
}

/** The audience a demo workspace writes for by default. */
export const ICP_FIXTURE: IcpContent = {
  id: null,
  name: 'Marketing lead at a small B2B software company',
  status: 'active',
  primary: true,
  who: 'The one person who owns content at a 10–50 person B2B software company, measured on pipeline and writing most of it themselves',
  pains: [
    {
      statement:
        'Researching and briefing one article takes most of a day, and half of that work is redone by whoever writes it',
      evidence: [{ ref: 'Onboarding interviews, 2026 Q2', note: '12 conversations' }],
      confidence: 'strong_directional',
    },
    {
      statement: 'They cannot say which published posts brought in anything',
      evidence: [],
      confidence: 'qualitative_pattern',
    },
  ],
  motivation: {
    text: 'They want to publish more without hiring, and would rather spend on tooling than on a second writer',
    hypothesis: true,
    confidence: 'hypothesis',
  },
  solution: {
    mechanism:
      'Research, brief, draft, checks, and scoring run as one pipeline with a person approving the brief before any writing is paid for',
    sampleLines: ['A brief before a draft, every time', 'Nothing publishes without a source'],
    confidence: 'verified',
  },
  competition: [
    {
      competitor: 'Competitor One',
      claim: 'AI writes your whole blog',
      claimedAt: '2026-03-01',
      source: 'competitor-one.com/pricing',
      confidence: 'verified',
    },
    {
      competitor: 'Competitor Two',
      claim: 'SEO on autopilot',
      claimedAt: '2025-11-01',
      source: '',
      confidence: 'inference',
    },
  ],
  whyUs: {
    text: 'Every claim is sourced or labelled, and a person signs off the angle before the money is spent',
    confidence: 'strong_directional',
  },
  channels: [
    { channel: 'LinkedIn', note: 'long-form posts from founders', confidence: 'qualitative_pattern' },
    { channel: 'Marketing Slack communities', note: '', confidence: 'cultural_signal' },
  ],
  churnTriggers: ['The first draft needs heavy editing', 'Nobody has time to approve briefs'],
  notOurUser: ['Solo bloggers with no review step', 'Agencies publishing at volume for many clients'],
}

/** A second audience, so the primary cascade and the brief's picker have something to choose between. */
export const ICP_FIXTURE_SECONDARY: IcpContent = {
  id: null,
  name: 'Founder writing the blog themselves',
  status: 'active',
  primary: false,
  who: 'A technical founder at a pre-Series-A software company who writes the blog between everything else',
  pains: [
    {
      statement: 'Writing one post costs them an afternoon they needed for the product',
      evidence: [],
      confidence: 'qualitative_pattern',
    },
  ],
  motivation: {
    text: 'They want the company to sound like them without spending their own week on it',
    hypothesis: true,
    confidence: 'hypothesis',
  },
  solution: {
    mechanism:
      'The brand voice and the audience are set up once, and every later draft is written and checked against them',
    sampleLines: ['Set the voice once, then stop rewriting drafts'],
    confidence: 'inference',
  },
  competition: [],
  whyUs: {
    text: 'The output sounds like the founder because the voice is governed, not prompted afresh each time',
    confidence: 'inference',
  },
  channels: [{ channel: 'Hacker News and founder communities', note: '', confidence: 'cultural_signal' }],
  churnTriggers: ['They hire a writer and hand the blog over'],
  notOurUser: ['Companies with a content team of three or more'],
}

/**
 * The position the demo workspace claims. Complete on purpose: it is the only
 * worked example of the framework most operators will ever see, so a partial
 * one would teach the wrong lesson about what "finished" looks like.
 */
export const POSITIONING_FIXTURE: PositioningContent = {
  category: 'governed content pipeline for small B2B software teams',
  goal: 'be the default way a small marketing team publishes content it can defend',
  promise: 'Every article you publish can be defended line by line',
  activePosition: 'the content pipeline with a reviewer gate',
  statement:
    'For the one person who owns content at a small B2B software company, Datum is the content pipeline that researches, briefs, writes, and checks each piece against a voice and an audience you set once — unlike tools that generate volume and leave the checking to you',
  macroFrame:
    'Generating text stopped being the hard part. Standing behind what was generated became it',
  landscape:
    'Volume generators promise a whole blog and leave the sourcing to you. Writing assistants help a person who is already writing. Agencies do the work but not on your terms. Datum governs the work: the same voice, the same audience, the same checks, every time',
  coreClaims: [
    { claim: 'Every claim in a draft is sourced or labelled as our reading', evidenceRef: '' },
    { claim: 'A person approves the angle before any writing is paid for', evidenceRef: '' },
    { claim: 'Every draft is checked and scored before anyone sees it', evidenceRef: '' },
  ],
  pillars: [
    {
      name: 'Governance',
      oneLine: 'One reviewer gate before anything costs money',
      carries: 'trust, cost control',
    },
    {
      name: 'Sourcing',
      oneLine: 'Nothing is stated that cannot be attributed',
      carries: 'credibility, defensibility',
    },
    {
      name: 'Consistency',
      oneLine: 'The voice and the audience are set once and applied every time',
      carries: 'recognition, less rework',
    },
  ],
  enemy: 'Publishing at volume without checking any of it, and quietly hoping nobody reads closely',
  archetype: 'the Sage',
  essence: 'calm certainty',
  descriptorLadder: [
    { descriptor: 'software', note: 'for someone with no context at all' },
    { descriptor: 'content platform', note: 'for a marketer' },
    { descriptor: 'governed content pipeline', note: 'for a buyer comparing tools' },
  ],
  vocabularyReachFor: [
    { term: 'sourced', note: 'the whole promise in one word' },
    { term: 'reviewer gate', note: 'names the thing nobody else has' },
    { term: 'brief', note: 'the artefact a person approves' },
    { term: 'evidence', note: 'what a claim rests on' },
  ],
  vocabularyAvoid: [
    { term: 'AI-powered', note: 'says nothing; everything is' },
    { term: 'autopilot', note: 'the enemy’s word' },
    { term: 'effortless', note: 'the work is the point' },
  ],
  openRulings: [
    { question: 'Do we call ourselves a CMS?', status: 'open', ruling: '', ruledAt: '' },
  ],
}

/**
 * The positioning fixture as the global stores it.
 *
 * Shared by the seed and the one-click demo fill rather than written twice,
 * because the two must agree: a workspace seeded from the CLI and one filled
 * from `/admin` are meant to be the same workspace. Empty dates become null —
 * Payload rejects `''` for a date column.
 */
export const positioningFixtureDoc = (): Record<string, unknown> => ({
  category: POSITIONING_FIXTURE.category,
  goal: POSITIONING_FIXTURE.goal,
  promise: POSITIONING_FIXTURE.promise,
  activePosition: POSITIONING_FIXTURE.activePosition,
  statement: POSITIONING_FIXTURE.statement,
  macroFrame: POSITIONING_FIXTURE.macroFrame,
  landscape: POSITIONING_FIXTURE.landscape,
  coreClaims: POSITIONING_FIXTURE.coreClaims.map((row) => ({ ...row })),
  pillars: POSITIONING_FIXTURE.pillars.map((row) => ({ ...row })),
  enemy: POSITIONING_FIXTURE.enemy,
  archetype: POSITIONING_FIXTURE.archetype,
  essence: POSITIONING_FIXTURE.essence,
  descriptorLadder: POSITIONING_FIXTURE.descriptorLadder.map((row) => ({ ...row })),
  vocabularyReachFor: POSITIONING_FIXTURE.vocabularyReachFor.map((row) => ({ ...row })),
  vocabularyAvoid: POSITIONING_FIXTURE.vocabularyAvoid.map((row) => ({ ...row })),
  openRulings: POSITIONING_FIXTURE.openRulings.map((row) => ({
    question: row.question,
    status: row.status,
    ruling: row.ruling,
    ruledAt: row.ruledAt || null,
  })),
})

/**
 * What the demo workspace may say about itself.
 *
 * Refs are pre-assigned rather than left to the global's hook, and `refCounter`
 * ships alongside them at 6, so the seed and the one-click fill produce
 * identical refs on every machine. A fixture whose `[E1]` meant a different
 * claim depending on the order rows happened to be written would make every
 * golden prompt test a coin toss.
 *
 * The re-check dates sit in 2027 so the demo bank is usable rather than
 * expired, and one row is deliberately rejected with a replacement, because the
 * "never state these" half is the part an operator has to see working to
 * believe.
 */
export const EVIDENCE_BANK_FIXTURE: EvidenceBankContent = {
  verifiedClaims: [
    {
      ref: 'E1',
      claim: 'A reviewer approves the brief before any drafting is paid for, on every article',
      primarySource: 'Datum pipeline audit export',
      sourceUrl: '',
      sourceDate: '2026-08-01',
      sampleOrMethod: 'Every article created in the 2026 H1 window; the status machine has no path from research to drafting that skips brief approval',
      verificationDepth: 'primary_document',
      limits: 'Describes the product, not customer behaviour; it does not say reviewers read the brief carefully',
      clearedSurfaces: ['web', 'blog'],
      recheckAt: '2027-06-30',
    },
    {
      ref: 'E2',
      claim: 'Every published draft carries a stored fact check, style review, and information-gain score',
      primarySource: 'Datum QA schema and article audit trail',
      sourceUrl: '',
      sourceDate: '2026-07-15',
      sampleOrMethod: 'The publish gate refuses an article whose QA results are absent',
      verificationDepth: 'reproduced',
      limits: 'A stored check is not a passing check; some articles are published after a reviewer overrides one',
      clearedSurfaces: [],
      recheckAt: '2027-03-31',
    },
    {
      ref: 'E3',
      claim: 'The median article costs under two dollars of model spend from research to scored draft',
      primarySource: 'Cost-log export, 2026 Q2',
      sourceUrl: '',
      sourceDate: '2026-07-01',
      sampleOrMethod: 'Median of all cost-log rows grouped by article across one quarter, mock runs excluded',
      // Every demo claim is verified past self-reported on purpose: a bank row
      // that is only somebody's word is incomplete, and the writer is never
      // offered one. A demo whose claims did not reach the draft would teach
      // the wrong lesson about what the bank is for.
      verificationDepth: 'primary_document',
      limits: 'Median, not typical: a regenerated article costs several times this. Excludes Ahrefs and hosting',
      clearedSurfaces: ['web', 'blog', 'sales'],
      recheckAt: '2027-01-31',
    },
  ],
  facts: [
    {
      ref: 'F4',
      fact: 'Datum stores its content in Payload CMS on Postgres, and publishes through Next.js',
      source: 'Product architecture',
      owner: 'engineering',
      lastConfirmedAt: '2026-08-20',
    },
    {
      ref: 'F5',
      fact: 'Datum runs entirely inside a customer’s own deployment; no article text leaves it except to the model provider',
      source: 'Deployment model',
      owner: 'engineering',
      lastConfirmedAt: '2026-08-20',
    },
  ],
  rejectedClaims: [
    {
      ref: 'R6',
      claim: 'Datum guarantees your articles will rank',
      status: 'rejected',
      reason: 'Nobody can guarantee a ranking, and the promise is about defensibility rather than placement',
      replacement: 'E1',
    },
  ],
}

/**
 * The evidence-bank fixture as the global stores it, with the counter that
 * makes the pre-assigned refs safe: the next row an operator adds gets `E7`,
 * not a second `E1`.
 */
export const evidenceBankFixtureDoc = (): Record<string, unknown> => ({
  verifiedClaims: EVIDENCE_BANK_FIXTURE.verifiedClaims.map((row) => ({
    ...row,
    clearedSurfaces: [...row.clearedSurfaces],
    // Payload rejects '' for a date column.
    sourceDate: row.sourceDate || null,
    recheckAt: row.recheckAt || null,
    verificationDepth: row.verificationDepth || null,
  })),
  facts: EVIDENCE_BANK_FIXTURE.facts.map((row) => ({
    ...row,
    lastConfirmedAt: row.lastConfirmedAt || null,
  })),
  rejectedClaims: EVIDENCE_BANK_FIXTURE.rejectedClaims.map((row) => ({ ...row })),
  refCounter: 6,
})
