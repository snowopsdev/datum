import type { LlmStage } from './config'

const bodyMarkdown = `## Introduction
This guide shows you how to set up a home espresso station that pulls cafe-quality shots. It is written for beginners with a budget of $500 to $1,500. Expect the setup to take about two hours, plus a week of practice.

## What you need
An espresso machine with a stable brew temperature. A burr grinder that can adjust in small steps. A scale that reads in 0.1 gram steps, a tamper, and fresh beans roasted within the past month.

## Step-by-step instructions
### Step 1: Pick your machine and grinder
Spend at least 40 percent of your budget on the grinder. A $300 grinder with a $700 machine beats the reverse. When both arrive, run water through the machine twice to rinse the boiler.

### Step 2: Dial in your first shot
Start with 18 grams of coffee in and aim for 36 grams of espresso out in 25 to 30 seconds. If the shot runs faster, grind finer. If it drips slowly or chokes, grind coarser. You should see a steady flow that looks like warm honey.

### Step 3: Steam milk and keep your gear clean
Purge the steam wand before and after each use. Wipe it with a damp cloth right away. Backflush the machine once a week with plain water. Clean the grinder burrs once a month.

## Common mistakes
Buying stale beans is the top mistake; check the roast date, not the best-by date. Skipping the scale is the second; guessing doses makes every shot a coin flip. Third, tamping too hard changes little, but tamping unevenly ruins the shot.

## FAQ
The questions below cover what most beginners ask in their first month.`

const generateFixture = {
  title: 'How to set up a home espresso station',
  slug: 'home-espresso-station-setup',
  titleTag: 'How to set up a home espresso station',
  metaDescription:
    'Set up a home espresso station step by step: pick a machine and grinder, dial in your first shot, and avoid the most common beginner mistakes.',
  ogTitle: 'How to set up a home espresso station',
  ogDescription: 'A step-by-step guide to building a home espresso station on a $500 to $1,500 budget.',
  ogImage: 'https://example.com/og/home-espresso-station.jpg',
  faqItems: [
    {
      question: 'How much should I spend on a first espresso setup?',
      answer:
        'Plan on $500 to $1,500 total. Put at least 40 percent of that into the grinder, because grind quality limits everything else.',
    },
    {
      question: 'Do I need a scale to make espresso?',
      answer:
        'Yes. A $20 scale that reads 0.1 gram steps removes most of the guesswork from dosing and lets you repeat good shots.',
    },
    {
      question: 'How long do roasted beans stay fresh?',
      answer:
        'Use beans within four to six weeks of the roast date. After that, shots taste flat and crema fades fast.',
    },
    {
      question: 'How often should I clean the machine?',
      answer:
        'Wipe the steam wand after every use, backflush weekly with plain water, and clean the grinder burrs monthly.',
    },
  ],
  bodyMarkdown,
}

const factCheckFixture = {
  passed: true,
  notes:
    'Checked the dose-to-yield ratio (18g in, 36g out in 25-30s) and the grinder budget guidance against current barista references. Both match common published advice. No factual claims contradicted.',
  sources: [
    'https://www.baristahustle.com/blog/espresso-recipes/',
    'https://www.seriouseats.com/how-to-buy-an-espresso-machine',
    'https://www.homegrounds.co/espresso-ratios/',
  ],
}

const qualitativeReviewFixture = {
  passed: true,
  notes:
    'Voice matches the style guide: plain-spoken, active, concrete numbers throughout. Paragraphs stay under four sentences and every heading is answered in its first sentence. No banned phrases found.',
  voiceScore: 4,
  voiceNotes:
    'Plain-spoken and confident throughout; the intro could be a touch warmer. No hype, no sarcasm, no jargon walls.',
  notTraitViolations: [],
}

/**
 * Claims a mock-mode run "extracts" from a baseline page. Every excerpt is
 * quoted verbatim from every canned body in `corpus/mockPages.ts`, so excerpt
 * verification passes for whichever host the mock SERP returns — edit one and
 * you must edit the other. All three mock pages return this same set, which is
 * why a mock snapshot's facets each show a `docCount` of 3.
 */
const pageClaimsFixture = {
  claims: [
    {
      text: 'A beginner home espresso setup costs between $500 and $1,500.',
      type: 'factual',
      excerpt: 'Most beginners spend between $500 and $1,500 on a first espresso setup.',
      entities: ['espresso setup'],
      values: ['$500', '$1,500'],
    },
    {
      text: 'The grinder matters more than the espresso machine for shot quality.',
      type: 'recommendation',
      excerpt: 'The grinder matters more than the machine.',
      entities: ['grinder', 'espresso machine'],
      values: [],
    },
    {
      text: 'A standard espresso recipe uses 18 grams of coffee in and 36 grams of espresso out.',
      type: 'factual',
      excerpt: 'Start with 18 grams in and 36 grams out in 25 to 30 seconds.',
      entities: ['espresso recipe'],
      values: ['18 grams', '36 grams'],
    },
    {
      text: 'An espresso shot should run for 25 to 30 seconds.',
      type: 'factual',
      excerpt: 'Start with 18 grams in and 36 grams out in 25 to 30 seconds.',
      entities: ['espresso shot'],
      values: ['25 to 30 seconds'],
    },
    {
      text: 'If a shot runs too fast, grind finer.',
      type: 'recommendation',
      excerpt: 'If the shot runs fast, grind finer.',
      entities: ['grinder'],
      values: [],
    },
    {
      text: 'Coffee beans should be used within a month of roasting.',
      type: 'factual',
      excerpt: 'use beans within a month of roasting.',
      entities: ['coffee beans'],
      values: ['a month'],
    },
    {
      text: 'Purge the steam wand before and after each use.',
      type: 'recommendation',
      excerpt: 'Purge the steam wand before and after each use',
      entities: ['steam wand'],
      values: [],
    },
    {
      text: 'The espresso machine should be backflushed weekly.',
      type: 'recommendation',
      excerpt: 'backflush weekly.',
      entities: ['espresso machine'],
      values: ['weekly'],
    },
  ],
}

/**
 * The clustering of three mock pages' worth of `pageClaimsFixture` (ids `b1-*`,
 * `b2-*`, `b3-*`) into the five facets those bodies share. Three of the labels
 * match a seeded How-To template's required sections, so `matchesHint` marks
 * them and the parser flags them `mustHave`.
 */
const facetClusteringFixture = {
  facets: [
    {
      id: 'f1',
      label: 'Budget and cost',
      description: 'What a first setup costs and how to split the budget.',
      claimIds: ['b1-1', 'b2-1', 'b3-1'],
      matchesHint: null,
    },
    {
      id: 'f2',
      label: 'What you need',
      description: 'Core equipment and why the grinder matters.',
      claimIds: ['b1-2', 'b2-2', 'b3-2'],
      matchesHint: 'What you need',
    },
    {
      id: 'f3',
      label: 'Step-by-step instructions',
      description: 'Dose, yield, and shot time for a first recipe.',
      claimIds: ['b1-3', 'b2-3', 'b3-3', 'b1-4', 'b2-4', 'b3-4', 'b1-5', 'b2-5', 'b3-5'],
      matchesHint: 'Step-by-step instructions',
    },
    {
      id: 'f4',
      label: 'Common mistakes',
      description: 'Bean freshness and other beginner errors.',
      claimIds: ['b1-6', 'b2-6', 'b3-6'],
      matchesHint: 'Common mistakes',
    },
    {
      id: 'f5',
      label: 'Cleaning and maintenance',
      description: 'Steam wand hygiene and backflushing cadence.',
      claimIds: ['b1-7', 'b2-7', 'b3-7', 'b1-8', 'b2-8', 'b3-8'],
      matchesHint: null,
    },
  ],
  gaps: [
    {
      facetId: 'f1',
      label: 'Buying used equipment',
      description:
        'None of the ranking pages say whether a used machine or grinder is a safe way to stretch the budget.',
      evidenceHint: 'Manufacturer refurbishment policies or a retailer returns page.',
    },
    {
      facetId: null,
      label: 'Water quality',
      description: 'No page covers how water hardness affects shot taste or machine scale.',
      evidenceHint: "SCA water standard or a machine manual's descaling guidance.",
    },
  ],
}

/**
 * Claims a mock-mode run "extracts" from the draft in `generateFixture`. Every
 * excerpt is quoted verbatim from that draft's `bodyMarkdown` or one of its
 * `faqItems`, so `excerptFoundIn` finds all of them — edit the draft and you
 * must edit these too (`pipeline/test/igFixtures.test.ts` fails when they
 * drift). Facet ids point at `facetClusteringFixture`, and all five facets are
 * covered so a mock run clears `minConsensusCoverage`.
 *
 * The shape is what a mock run needs to reach a PASS: eleven claims the ranking
 * pages already make, plus two the mock judge rates as materially novel — the
 * grinder budget share and the bean freshness window — which are the two the
 * verifier fixture then backs with evidence. Index 11 restates index 0, so the
 * intra-document novelty discount has something to bite on.
 */
const draftClaimsFixture = {
  claims: [
    {
      text: 'A beginner home espresso setup fits a budget of $500 to $1,500.',
      type: 'factual',
      excerpt: 'It is written for beginners with a budget of $500 to $1,500.',
      section: 'Introduction',
      facetId: 'f1',
      entities: ['home espresso setup'],
      values: ['$500', '$1,500'],
      restatesClaimIndex: null,
    },
    {
      text: 'An espresso machine for home use needs a stable brew temperature.',
      type: 'recommendation',
      excerpt: 'An espresso machine with a stable brew temperature.',
      section: 'What you need',
      facetId: 'f2',
      entities: ['espresso machine'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'A burr grinder for espresso must adjust in small steps.',
      type: 'recommendation',
      excerpt: 'A burr grinder that can adjust in small steps.',
      section: 'What you need',
      facetId: 'f2',
      entities: ['burr grinder'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'At least 40 percent of a first espresso budget goes to the grinder.',
      type: 'factual',
      excerpt: 'Spend at least 40 percent of your budget on the grinder.',
      section: 'Step-by-step instructions',
      facetId: 'f1',
      entities: ['grinder', 'espresso budget'],
      values: ['40 percent'],
      restatesClaimIndex: null,
    },
    {
      text: 'A $300 grinder paired with a $700 machine beats the opposite split.',
      type: 'comparison',
      excerpt: 'A $300 grinder with a $700 machine beats the reverse.',
      section: 'Step-by-step instructions',
      facetId: 'f1',
      entities: ['grinder', 'espresso machine'],
      values: ['$300', '$700'],
      restatesClaimIndex: null,
    },
    {
      text: 'A first espresso recipe is 18 grams in and 36 grams out in 25 to 30 seconds.',
      type: 'factual',
      excerpt:
        'Start with 18 grams of coffee in and aim for 36 grams of espresso out in 25 to 30 seconds.',
      section: 'Step-by-step instructions',
      facetId: 'f3',
      entities: ['espresso recipe'],
      values: ['18 grams', '36 grams', '25 to 30 seconds'],
      restatesClaimIndex: null,
    },
    {
      text: 'A shot that runs faster than the target time needs a finer grind.',
      type: 'recommendation',
      excerpt: 'If the shot runs faster, grind finer.',
      section: 'Step-by-step instructions',
      facetId: 'f3',
      entities: ['espresso shot'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'A shot that drips slowly or chokes needs a coarser grind.',
      type: 'recommendation',
      excerpt: 'If it drips slowly or chokes, grind coarser.',
      section: 'Step-by-step instructions',
      facetId: 'f3',
      entities: ['espresso shot'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'The steam wand is purged before and after every use.',
      type: 'recommendation',
      excerpt: 'Purge the steam wand before and after each use.',
      section: 'Step-by-step instructions',
      facetId: 'f5',
      entities: ['steam wand'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'The espresso machine is backflushed once a week with plain water.',
      type: 'recommendation',
      excerpt: 'Backflush the machine once a week with plain water.',
      section: 'Step-by-step instructions',
      facetId: 'f5',
      entities: ['espresso machine'],
      values: ['once a week'],
      restatesClaimIndex: null,
    },
    {
      text: 'Buying stale beans is the most common beginner espresso mistake.',
      type: 'factual',
      excerpt: 'Buying stale beans is the top mistake; check the roast date, not the best-by date.',
      section: 'Common mistakes',
      facetId: 'f4',
      entities: ['coffee beans'],
      values: [],
      restatesClaimIndex: null,
    },
    {
      text: 'A first espresso setup costs $500 to $1,500 in total.',
      type: 'factual',
      excerpt: 'Plan on $500 to $1,500 total.',
      section: 'FAQ',
      facetId: 'f1',
      entities: ['home espresso setup'],
      values: ['$500', '$1,500'],
      restatesClaimIndex: 0,
    },
    {
      text: 'Roasted coffee beans stay at their best for four to six weeks after the roast date.',
      type: 'factual',
      excerpt: 'Use beans within four to six weeks of the roast date.',
      section: 'FAQ',
      facetId: 'f4',
      entities: ['coffee beans', 'roast date'],
      values: ['four to six weeks'],
      restatesClaimIndex: null,
    },
  ],
}

/**
 * The mock judge's verdict on `draftClaimsFixture`, one entry per claim id in
 * the same order `parseDraftClaims` assigns them (`c001`…`c013`) — the parser
 * throws on a missing id, so the two must stay in step.
 *
 * Eleven claims come back as near-duplicates of the baseline (0.85–0.95), which
 * is what the espresso draft honestly is: a competent restatement of what the
 * ranking pages already say. The two exceptions are `c004` (the 40 percent
 * grinder split) and `c013` (the four-to-six-week freshness window), which the
 * verifier fixture then backs. `relevanceByQuery` covers the mock SERP's
 * cluster (`q0` keyword plus three related questions); ids outside the cluster
 * are dropped by the parser, so listing four here is safe either way. Nothing
 * looks internally duplicated — a mock run has no published corpus to duplicate.
 */
const informationGainJudgeFixture = {
  claims: [
    {
      claimId: 'c001',
      duplicateProbability: 0.93,
      closestBaselineClaimId: 'b1-1',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.8, q1: 0.35, q2: 0.9, q3: 0.3 },
      utility: {
        specificity: 0.7,
        actionability: 0.5,
        explanatoryPower: 0.45,
        audienceFit: 0.8,
      },
      importance: 1.1,
      containsNumericOrTemporalClaim: true,
      rationale: 'Every ranking page opens with the same $500-$1,500 starter budget.',
    },
    {
      claimId: 'c002',
      duplicateProbability: 0.86,
      closestBaselineClaimId: null,
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.7, q1: 0.2, q2: 0.35, q3: 0.4 },
      utility: {
        specificity: 0.45,
        actionability: 0.4,
        explanatoryPower: 0.5,
        audienceFit: 0.7,
      },
      importance: 0.9,
      containsNumericOrTemporalClaim: false,
      rationale:
        'Temperature stability is standard buying advice, though no baseline claim states it outright.',
    },
    {
      claimId: 'c003',
      duplicateProbability: 0.9,
      closestBaselineClaimId: 'b1-2',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.7, q1: 0.2, q2: 0.4, q3: 0.4 },
      utility: {
        specificity: 0.5,
        actionability: 0.45,
        explanatoryPower: 0.5,
        audienceFit: 0.7,
      },
      importance: 0.9,
      containsNumericOrTemporalClaim: false,
      rationale: 'The baseline already argues the grinder is the part that has to adjust finely.',
    },
    {
      claimId: 'c004',
      duplicateProbability: 0.12,
      closestBaselineClaimId: 'b1-2',
      internalDuplicateProbability: 0.08,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.95, q1: 0.55, q2: 0.95, q3: 0.6 },
      utility: {
        specificity: 0.95,
        actionability: 0.9,
        explanatoryPower: 0.75,
        audienceFit: 0.9,
      },
      importance: 1.6,
      containsNumericOrTemporalClaim: true,
      rationale:
        'The baseline says the grinder matters more; none of it puts a share of the budget on that advice.',
    },
    {
      claimId: 'c005',
      duplicateProbability: 0.88,
      closestBaselineClaimId: 'b1-2',
      internalDuplicateProbability: 0.08,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.8, q1: 0.3, q2: 0.85, q3: 0.4 },
      utility: {
        specificity: 0.7,
        actionability: 0.6,
        explanatoryPower: 0.6,
        audienceFit: 0.8,
      },
      importance: 1.1,
      containsNumericOrTemporalClaim: true,
      rationale: 'A worked example of the grinder-first advice the baseline already gives.',
    },
    {
      claimId: 'c006',
      duplicateProbability: 0.94,
      closestBaselineClaimId: 'b1-3',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.85, q1: 0.45, q2: 0.3, q3: 0.5 },
      utility: {
        specificity: 0.8,
        actionability: 0.8,
        explanatoryPower: 0.5,
        audienceFit: 0.8,
      },
      importance: 1.2,
      containsNumericOrTemporalClaim: true,
      rationale: 'The 18-in/36-out recipe is stated verbatim by every ranking page.',
    },
    {
      claimId: 'c007',
      duplicateProbability: 0.92,
      closestBaselineClaimId: 'b1-5',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.75, q1: 0.4, q2: 0.25, q3: 0.45 },
      utility: {
        specificity: 0.6,
        actionability: 0.8,
        explanatoryPower: 0.5,
        audienceFit: 0.75,
      },
      importance: 1,
      containsNumericOrTemporalClaim: false,
      rationale: 'The grind-finer correction is baseline advice.',
    },
    {
      claimId: 'c008',
      duplicateProbability: 0.87,
      closestBaselineClaimId: 'b1-5',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.75, q1: 0.4, q2: 0.25, q3: 0.45 },
      utility: {
        specificity: 0.6,
        actionability: 0.8,
        explanatoryPower: 0.5,
        audienceFit: 0.75,
      },
      importance: 1,
      containsNumericOrTemporalClaim: false,
      rationale: 'The mirror image of the baseline grind-finer advice; implied rather than stated.',
    },
    {
      claimId: 'c009',
      duplicateProbability: 0.95,
      closestBaselineClaimId: 'b1-7',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.6, q1: 0.2, q2: 0.2, q3: 0.35 },
      utility: {
        specificity: 0.55,
        actionability: 0.75,
        explanatoryPower: 0.35,
        audienceFit: 0.65,
      },
      importance: 0.8,
      containsNumericOrTemporalClaim: false,
      rationale: 'Word-for-word the same steam wand instruction as the baseline.',
    },
    {
      claimId: 'c010',
      duplicateProbability: 0.93,
      closestBaselineClaimId: 'b1-8',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.6, q1: 0.25, q2: 0.2, q3: 0.35 },
      utility: {
        specificity: 0.6,
        actionability: 0.75,
        explanatoryPower: 0.35,
        audienceFit: 0.65,
      },
      importance: 0.8,
      containsNumericOrTemporalClaim: true,
      rationale: 'Weekly backflushing is the baseline cadence.',
    },
    {
      claimId: 'c011',
      duplicateProbability: 0.9,
      closestBaselineClaimId: 'b1-6',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.7, q1: 0.3, q2: 0.25, q3: 0.55 },
      utility: {
        specificity: 0.55,
        actionability: 0.65,
        explanatoryPower: 0.55,
        audienceFit: 0.75,
      },
      importance: 1,
      containsNumericOrTemporalClaim: false,
      rationale: 'Bean freshness leads the baseline mistake lists too.',
    },
    {
      claimId: 'c012',
      duplicateProbability: 0.93,
      closestBaselineClaimId: 'b1-1',
      internalDuplicateProbability: 0.05,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.8, q1: 0.35, q2: 0.9, q3: 0.3 },
      utility: {
        specificity: 0.7,
        actionability: 0.5,
        explanatoryPower: 0.4,
        audienceFit: 0.8,
      },
      importance: 1.1,
      containsNumericOrTemporalClaim: true,
      rationale: 'The FAQ repeats the intro budget, which the baseline also states.',
    },
    {
      claimId: 'c013',
      duplicateProbability: 0.15,
      closestBaselineClaimId: 'b1-6',
      internalDuplicateProbability: 0.1,
      closestInternalClaimId: null,
      relevanceByQuery: { q0: 0.9, q1: 0.75, q2: 0.5, q3: 0.5 },
      utility: {
        specificity: 0.9,
        actionability: 0.85,
        explanatoryPower: 0.8,
        audienceFit: 0.9,
      },
      importance: 1.5,
      containsNumericOrTemporalClaim: true,
      rationale:
        'The baseline says "within a month"; a four-to-six-week window is a different and more precise figure.',
    },
  ],
}

/**
 * The mock verifier's evidence for the two materially novel claims — the only
 * ones `pickForVerification` sends to a verifier call, since the rest are
 * duplicates of the baseline.
 *
 * Each excerpt quotes the claim's values in the *same* form the claim states
 * them ("40 percent", "four to six weeks"), which is what makes `compareValues`
 * return an exactness of 1; paraphrasing "40 percent" as "two fifths" here would
 * fail the numeric gate and block the mock draft.
 *
 * Both claims carry numbers, so their evidence integrity is measured against
 * `minNumericTemporalIntegrity` (0.95 by default) — and integrity is
 * `support x sourceQuality x exactness`. A rubric class alone is capped at
 * `UNKNOWN_DOMAIN_CAP` (0.75), so with support 0.95 these citations reach only
 * 0.71 until the `evidence-sources` table vouches for their domains. A mock run
 * that must end in PASS therefore has to seed rules for `sca.coffee`,
 * `baristahustle.com`, and `homegrounds.co`.
 */
const evidenceVerificationFixture = {
  claims: [
    {
      claimId: 'c004',
      support: 0.95,
      contradiction: 0.05,
      evidence: [
        {
          url: 'https://sca.coffee/research/grinder-share-of-budget',
          excerpt:
            'Our buyers guide recommends allocating at least 40 percent of an espresso budget to the grinder.',
          publisher: 'Specialty Coffee Association',
          sourceKind: 'official_docs',
        },
        {
          url: 'https://www.baristahustle.com/blog/grinder-budget/',
          excerpt:
            'Put at least 40 percent of your total espresso budget into the grinder before you upgrade the machine.',
          publisher: 'Barista Hustle',
          sourceKind: 'secondary',
        },
      ],
      notes:
        'Two independent buying guides state the same 40 percent share; neither disputes the figure.',
    },
    {
      claimId: 'c013',
      support: 0.95,
      contradiction: 0.05,
      evidence: [
        {
          url: 'https://sca.coffee/research/coffee-freshness',
          excerpt:
            'Espresso roasts are at their best four to six weeks past the roast date, after which aromatics fade.',
          publisher: 'Specialty Coffee Association',
          sourceKind: 'official_docs',
        },
        {
          url: 'https://www.homegrounds.co/how-long-does-coffee-stay-fresh/',
          excerpt:
            'Roasted coffee holds its peak flavour for four to six weeks after the roast date.',
          publisher: 'Home Grounds',
          sourceKind: 'secondary',
        },
      ],
      notes:
        'Both sources give the same four-to-six-week window; retailer "best by" dates are longer but measure staleness, not peak flavour.',
    },
  ],
}

type FixtureTable = Record<LlmStage, unknown | Record<string, unknown>>

const fixtures: FixtureTable = {
  generate: generateFixture,
  factCheck: factCheckFixture,
  qualitativeReview: qualitativeReviewFixture,
  claimExtraction: {
    page: pageClaimsFixture,
    draft: draftClaimsFixture,
    facets: facetClusteringFixture,
  },
  informationGainJudge: informationGainJudgeFixture,
  evidenceVerification: evidenceVerificationFixture,
}

/**
 * Mock-mode fixture for one LLM stage. Some stages serve several call shapes
 * (e.g. claim extraction runs against a ranking page, a published article, and
 * a draft) — pass `fixtureKey` to select a sub-fixture from that stage's entry.
 * Deep-copies so callers can't mutate the canned fixture between runs.
 */
export function mockFixture(stage: LlmStage, fixtureKey?: string): unknown {
  const entry = fixtures[stage]
  const isPlainObject = typeof entry === 'object' && entry !== null && !Array.isArray(entry)
  if (fixtureKey !== undefined) {
    if (isPlainObject && fixtureKey in (entry as Record<string, unknown>)) {
      return JSON.parse(JSON.stringify((entry as Record<string, unknown>)[fixtureKey]))
    }
    throw new Error(`no mock fixture for ${stage}/${fixtureKey}`)
  }
  return JSON.parse(JSON.stringify(entry))
}

export const mockUsage: Record<
  LlmStage,
  { inputTokens: number; outputTokens: number; webSearchRequests: number }
> = {
  generate: { inputTokens: 1240, outputTokens: 860, webSearchRequests: 0 },
  factCheck: { inputTokens: 1180, outputTokens: 790, webSearchRequests: 2 },
  qualitativeReview: { inputTokens: 1210, outputTokens: 805, webSearchRequests: 0 },
  claimExtraction: { inputTokens: 5200, outputTokens: 1400, webSearchRequests: 0 },
  informationGainJudge: { inputTokens: 3600, outputTokens: 1200, webSearchRequests: 0 },
  evidenceVerification: { inputTokens: 2900, outputTokens: 900, webSearchRequests: 3 },
}
