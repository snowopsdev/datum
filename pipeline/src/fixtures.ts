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

// PR3 fills in real content for the information-gain fixtures below; these are
// placeholders so the new stages have a valid mock-mode shape to call today.
type FixtureTable = Record<LlmStage, unknown | Record<string, unknown>>

const fixtures: FixtureTable = {
  generate: generateFixture,
  factCheck: factCheckFixture,
  qualitativeReview: qualitativeReviewFixture,
  claimExtraction: {
    page: { claims: [] },
    draft: { claims: [] },
    facets: { facets: [], gaps: [] },
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
