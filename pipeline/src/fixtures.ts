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

// PR3 fills in the draft-side claim fixture; the rest of the information-gain
// fixtures below are placeholders with a valid mock-mode shape.
type FixtureTable = Record<LlmStage, unknown | Record<string, unknown>>

const fixtures: FixtureTable = {
  generate: generateFixture,
  factCheck: factCheckFixture,
  qualitativeReview: qualitativeReviewFixture,
  claimExtraction: {
    page: pageClaimsFixture,
    draft: { claims: [] },
    facets: facetClusteringFixture,
  },
  informationGainJudge: { claims: [] },
  evidenceVerification: { claims: [] },
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
