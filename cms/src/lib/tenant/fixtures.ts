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
  companyName: 'Kettle & Burr',
  targetDomain: 'kettleandburr.example.com',
  competitors: [
    {
      domain: 'competitor-one.com',
      name: 'Competitor One',
    },
    {
      domain: 'competitor-two.com',
      name: 'Competitor Two',
    },
  ],
  siteNotes:
    'Independent home-espresso guides: equipment comparisons, repeatable recipes, and maintenance advice with test methods and limits.',
}

/** The audience a demo workspace writes for by default. */
export const ICP_FIXTURE: IcpContent = {
  id: null,
  name: 'Home barista upgrading from a pod machine',
  status: 'active',
  primary: true,
  who: 'A home barista upgrading from a pod machine, choosing a first espresso machine and grinder on a fixed budget',
  pains: [
    {
      statement:
        'Choosing an espresso grinder is confusing when every review recommends different equipment',
      confidence: 'strong_directional',
      evidence: [
        {
          ref: 'Reader interviews, 2026 Q2',
          note: '12 conversations',
        },
      ],
    },
    {
      statement: 'Dialing in espresso wastes beans before they learn which adjustment to make',
      confidence: 'qualitative_pattern',
      evidence: [],
    },
  ],
  motivation: {
    text: 'They want repeatable café-quality espresso at home without spending beyond their budget',
    hypothesis: true,
    confidence: 'hypothesis',
  },
  solution: {
    mechanism: 'We compare equipment with repeatable tests and explain one adjustment at a time',
    sampleLines: [
      'Spend on the grinder before the extras',
      'Change one variable, then taste again',
    ],
    confidence: 'verified',
  },
  competition: [
    {
      competitor: 'Competitor One',
      claim: 'The perfect espresso setup for everyone',
      claimedAt: '2026-03-01',
      source: 'competitor-one.com/guides',
      confidence: 'verified',
    },
    {
      competitor: 'Competitor Two',
      claim: 'Barista results without practice',
      claimedAt: '2025-11-01',
      source: '',
      confidence: 'inference',
    },
  ],
  whyUs: {
    text: 'We show test methods and limits so the reader can choose for their own kitchen',
    confidence: 'strong_directional',
  },
  channels: [
    {
      channel: 'Home-Barista forums',
      note: 'equipment and recipe discussions',
      confidence: 'qualitative_pattern',
    },
    {
      channel: 'Local coffee communities',
      note: '',
      confidence: 'cultural_signal',
    },
  ],
  notOurUser: ['Wholesale equipment buyers', 'Industrial coffee roasters'],
  churnTriggers: [
    'Advice assumes unlimited spending',
    'Recipes skip the adjustments beginners need',
  ],
}

/** A second audience, so the primary cascade and the brief's picker have something to choose between. */
export const ICP_FIXTURE_SECONDARY: IcpContent = {
  id: null,
  name: 'Café owner training new staff',
  status: 'active',
  primary: false,
  who: 'The owner of an independent café training new staff to make consistent espresso',
  pains: [
    {
      statement: 'New staff pull inconsistent espresso shots during the morning rush',
      confidence: 'qualitative_pattern',
      evidence: [],
    },
  ],
  motivation: {
    text: 'They want a simple training routine that keeps drinks consistent across shifts',
    hypothesis: true,
    confidence: 'hypothesis',
  },
  solution: {
    mechanism:
      'We explain repeatable dialing-in and cleaning routines that a new barista can follow',
    sampleLines: ['Write down the recipe before the rush'],
    confidence: 'inference',
  },
  competition: [],
  whyUs: {
    text: 'The guides explain the reason behind each adjustment',
    confidence: 'inference',
  },
  channels: [
    {
      channel: 'Independent café owner communities',
      note: '',
      confidence: 'cultural_signal',
    },
  ],
  notOurUser: ['Franchise procurement departments'],
  churnTriggers: ['The advice ignores service time and staff turnover'],
}

/**
 * The position the demo workspace claims. Complete on purpose: it is the only
 * worked example of the framework most operators will ever see, so a partial
 * one would teach the wrong lesson about what "finished" looks like.
 */
export const POSITIONING_FIXTURE: PositioningContent = {
  category: 'independent home-espresso guides',
  goal: 'help home baristas make repeatable espresso within their budget',
  promise: 'Choose equipment and recipes with the method and limits in view',
  activePosition: 'the espresso guides that show their working',
  statement:
    'For home baristas choosing their first setup, Kettle & Burr is the independent guide publisher that compares equipment with repeatable tests and explains adjustments, unlike rankings that hide how recommendations were made',
  macroFrame: 'More equipment choices make a clear test method more useful than another ranking',
  landscape:
    'Retailer guides sell equipment. Enthusiast forums share experience. Kettle & Burr turns repeatable tests into practical decisions',
  coreClaims: [
    {
      claim: 'Our budget grinder comparison used six grinders over one month',
      evidenceRef: 'E1',
    },
    {
      claim: 'Our guides explain the testing method and its limits',
      evidenceRef: 'E2',
    },
    {
      claim: 'Our membership supports reader workshops',
      evidenceRef: 'E3',
    },
  ],
  pillars: [
    {
      name: 'Repeatability',
      oneLine: 'Change one variable and record the result',
      carries: 'confidence, learning',
    },
    {
      name: 'Transparency',
      oneLine: 'Show the method and limits',
      carries: 'trust',
    },
    {
      name: 'Practicality',
      oneLine: 'Work within the reader’s budget and kitchen',
      carries: 'usefulness',
    },
  ],
  enemy: 'Buying more equipment before understanding the shot',
  archetype: 'the Sage',
  essence: 'patient clarity',
  descriptorLadder: [
    {
      descriptor: 'publisher',
      note: 'for someone with no context',
    },
    {
      descriptor: 'coffee guide publisher',
      note: 'for a new reader',
    },
    {
      descriptor: 'independent home-espresso guides',
      note: 'for someone comparing sources',
    },
  ],
  vocabularyReachFor: [
    {
      term: 'repeatable',
      note: 'the goal of each recipe',
    },
    {
      term: 'test method',
      note: 'show our working',
    },
    {
      term: 'adjustment',
      note: 'one change at a time',
    },
    {
      term: 'limits',
      note: 'what the test cannot tell you',
    },
  ],
  vocabularyAvoid: [
    {
      term: 'perfect',
      note: 'taste and kitchens differ',
    },
    {
      term: 'effortless',
      note: 'practice matters',
    },
    {
      term: 'guaranteed',
      note: 'results depend on the setup',
    },
  ],
  openRulings: [
    {
      question: 'Should we cover commercial machines?',
      status: 'open',
      ruling: '',
      ruledAt: '',
    },
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
 * ships alongside them at 7, so the seed and the one-click fill produce
 * identical refs on every machine. One incomplete claim demonstrates the review
 * boundary, and one complete claim is cleared only for sales. A fixture whose `[E1]` meant a different
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
      sourceUrl: '',
      sourceDate: '2026-08-01',
      verificationDepth: 'primary_document',
      recheckAt: '2027-06-30',
      ref: 'E1',
      claim: 'Kettle & Burr tested six budget espresso grinders for a month',
      primarySource: 'Kettle & Burr grinder test log',
      sampleOrMethod: 'Six grinders, the same beans and recipe, one month of recorded shots',
      limits: 'Describes this comparison, not every grinder or every reader’s results',
      clearedSurfaces: ['web', 'blog'],
    },
    {
      sourceUrl: '',
      sourceDate: '2026-07-15',
      verificationDepth: 'reproduced',
      recheckAt: '2027-03-31',
      ref: 'E2',
      claim: 'Kettle & Burr publishes the method and limits alongside each equipment comparison',
      primarySource: 'Kettle & Burr editorial checklist',
      sampleOrMethod: 'Editorial review of published equipment comparisons',
      limits: 'A disclosed method does not guarantee a recommendation fits every kitchen',
      clearedSurfaces: [],
    },
    {
      sourceUrl: '',
      sourceDate: '2026-07-01',
      verificationDepth: 'primary_document',
      recheckAt: '2027-01-31',
      ref: 'E3',
      claim: 'Members can attend monthly espresso workshops',
      primarySource: 'Kettle & Burr workshop schedule',
      sampleOrMethod: 'Membership programme schedule',
      limits: 'Availability depends on the published schedule; attendance is not guaranteed',
      clearedSurfaces: ['sales'],
    },
    {
      sourceUrl: '',
      sourceDate: '2026-08-01',
      verificationDepth: 'self_reported',
      recheckAt: '',
      ref: 'E7',
      claim: 'Readers waste fewer beans after following our dialing-in guide',
      primarySource: '',
      sampleOrMethod: '',
      limits: '',
      clearedSurfaces: [],
    },
  ],
  facts: [
    {
      ref: 'F4',
      fact: 'Kettle & Burr publishes independent home-espresso guides',
      source: 'Editorial charter',
      owner: 'editorial',
      lastConfirmedAt: '2026-08-20',
    },
    {
      ref: 'F5',
      fact: 'Kettle & Burr offers equipment comparisons and brewing recipes',
      source: 'Guide catalogue',
      owner: 'editorial',
      lastConfirmedAt: '2026-08-20',
    },
  ],
  rejectedClaims: [
    {
      ref: 'R6',
      claim: 'Kettle & Burr guarantees perfect espresso',
      status: 'rejected',
      reason: 'Equipment, beans, water, and practice change the result',
      replacement: 'E1',
    },
  ],
}

/**
 * The evidence-bank fixture as the global stores it, with the counter that
 * makes the pre-assigned refs safe: the next row an operator adds gets `E8`,
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
  refCounter: 7,
})
