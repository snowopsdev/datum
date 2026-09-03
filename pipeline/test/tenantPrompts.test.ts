import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EVIDENCE_BANK_FIXTURE,
  ICP_FIXTURE,
  POSITIONING_FIXTURE,
} from '../../cms/src/lib/tenant/fixtures'
import {
  CONFIDENCE_LEGEND,
  CONFIDENCE_LEVELS,
  confidenceTag,
  emptyIcpContent,
  emptyPositioningContent,
  evidenceBankToPrompt,
  icpToPrompt,
  positioningToPrompt,
} from '../src/tenant'

/**
 * What the writer and the qualitative reviewer are actually shown about the
 * audience.
 *
 * These are golden strings on purpose. The block is the only thing telling the
 * model that a `[hypothesis]` motivation may not be stated as a finding, so a
 * silent change to its shape is a change to what the pipeline is allowed to
 * publish. Anything that moves here should move because somebody decided it
 * should.
 */

const ICP = {
  ...emptyIcpContent('Growth marketer at a Series B SaaS'),
  id: 7,
  status: 'active' as const,
  primary: true,
  who: 'Marketing lead at a 50–200 person B2B SaaS who owns the blog and is measured on pipeline',
  pains: [
    {
      statement: 'Every content brief takes a day to research and half of it is redone by the writer',
      evidence: [{ ref: '12 onboarding interviews', note: 'Q2' }],
      confidence: 'strong_directional' as const,
    },
    {
      statement: 'Cannot prove which posts drove pipeline',
      evidence: [],
      confidence: 'qualitative_pattern' as const,
    },
  ],
  motivation: {
    text: 'Wants to ship more without hiring; would trade tooling budget for headcount',
    hypothesis: true,
    confidence: 'hypothesis' as const,
  },
  solution: {
    mechanism:
      'Research, brief, draft, and QA run as one governed pipeline with a human gate before writing',
    sampleLines: ['A brief before a draft, every time', 'Nothing publishes without a source'],
    confidence: 'verified' as const,
  },
  competition: [
    {
      competitor: 'Rival One',
      claim: 'AI writes your whole blog',
      claimedAt: '2026-03-01T00:00:00.000Z',
      source: 'rivalone.com/pricing',
      confidence: 'verified' as const,
    },
    {
      competitor: 'Rival Two',
      claim: 'SEO on autopilot',
      claimedAt: '2025-11-01T00:00:00.000Z',
      source: '',
      confidence: 'inference' as const,
    },
  ],
  whyUs: { text: 'Verified claims and a reviewer gate, not volume', confidence: 'strong_directional' as const },
  channels: [
    { channel: 'LinkedIn', note: 'long-form posts from founders', confidence: 'qualitative_pattern' as const },
    { channel: 'Marketing Slack communities', note: '', confidence: 'cultural_signal' as const },
  ],
  churnTriggers: ['Churns when the first draft needs heavy edits'],
  notOurUser: ['Solo bloggers without a review process'],
}

describe('icpToPrompt', () => {
  it('renders the audience block exactly', () => {
    assert.equal(
      icpToPrompt(ICP),
      [
        '# Audience: Growth marketer at a Series B SaaS (primary ICP)',
        CONFIDENCE_LEGEND,
        '',
        '## Who',
        'Marketing lead at a 50–200 person B2B SaaS who owns the blog and is measured on pipeline',
        '',
        '## Pain',
        '- Every content brief takes a day to research and half of it is redone by the writer. ' +
          '[strong directional] (evidence: 12 onboarding interviews (Q2))',
        '- Cannot prove which posts drove pipeline. [qualitative pattern]',
        '',
        '## Motivation (hypothesis)',
        'Wants to ship more without hiring; would trade tooling budget for headcount. [hypothesis]',
        '',
        '## How we solve it',
        'Mechanism: Research, brief, draft, and QA run as one governed pipeline with a human gate ' +
          'before writing. [verified]',
        'Lines that land: "A brief before a draft, every time" / "Nothing publishes without a source"',
        '',
        '## The competition (what they claim, and when)',
        '- Rival One — "AI writes your whole blog" (claimed 2026-03, rivalone.com/pricing) [verified]',
        '- Rival Two — "SEO on autopilot" (claimed 2025-11) [inference]',
        '',
        '## Why us',
        'Verified claims and a reviewer gate, not volume. [strong directional]',
        '',
        '## Where they are',
        '- LinkedIn (long-form posts from founders) [qualitative pattern]',
        '- Marketing Slack communities [cultural signal]',
        '',
        '## Not our user / churn triggers',
        '- Solo bloggers without a review process',
        '- Churns when the first draft needs heavy edits',
      ].join('\n'),
    )
  })

  it('carries a legend covering every confidence level', () => {
    const block = icpToPrompt(ICP)
    for (const level of CONFIDENCE_LEVELS) {
      assert.ok(block.includes(confidenceTag(level)) || CONFIDENCE_LEGEND.includes(confidenceTag(level)))
      assert.ok(CONFIDENCE_LEGEND.includes(confidenceTag(level)), `legend is missing ${level}`)
    }
    assert.match(CONFIDENCE_LEGEND, /\[verified\]\/\[strong directional\] state it plainly/)
    assert.match(CONFIDENCE_LEGEND, /\[inference\]\/\[hypothesis\] attribute it to us, never as fact/)
  })

  it('omits every section it has nothing for, rather than sending a bare heading', () => {
    const bare = icpToPrompt({
      ...emptyIcpContent('Minimal audience'),
      who: 'Somebody',
      pains: [{ statement: 'It hurts', evidence: [], confidence: null }],
    })
    assert.equal(
      bare,
      [
        '# Audience: Minimal audience',
        CONFIDENCE_LEGEND,
        '',
        '## Who',
        'Somebody',
        '',
        '## Pain',
        '- It hurts.',
      ].join('\n'),
    )
    for (const heading of [
      '## Motivation',
      '## How we solve it',
      '## The competition',
      '## Why us',
      '## Where they are',
      '## Not our user',
    ]) {
      assert.ok(!bare.includes(heading), `${heading} should have been omitted`)
    }
  })

  it('marks the primary only when it is the primary', () => {
    assert.match(icpToPrompt(ICP, { primary: true }), /\(primary ICP\)/)
    assert.doesNotMatch(icpToPrompt(ICP, { primary: false }), /\(primary ICP\)/)
    // Defaults to the record's own flag, so a caller that knows nothing still
    // labels a primary audience correctly.
    assert.match(icpToPrompt({ ...ICP, primary: true }), /\(primary ICP\)/)
    assert.doesNotMatch(icpToPrompt({ ...ICP, primary: false }), /\(primary ICP\)/)
  })

  it('renders nothing at all for no audience, or one without a name', () => {
    assert.equal(icpToPrompt(null), '')
    assert.equal(icpToPrompt(undefined), '')
    assert.equal(icpToPrompt(emptyIcpContent()), '')
  })

  it('renders the same string twice, so a prompt snapshot is comparable', () => {
    assert.equal(icpToPrompt(ICP), icpToPrompt(ICP))
    assert.equal(icpToPrompt(ICP_FIXTURE), icpToPrompt(ICP_FIXTURE))
  })

  it('drops a claim date it cannot read rather than printing a raw timestamp', () => {
    const block = icpToPrompt({
      ...emptyIcpContent('x'),
      who: 'w',
      competition: [
        { competitor: 'Rival', claim: 'c', claimedAt: 'whenever', source: '', confidence: null },
      ],
    })
    assert.ok(block.includes('- Rival — "c"'))
    assert.ok(!block.includes('whenever'))
  })
})

/**
 * What the writer and the reviewer are shown about the position.
 *
 * Golden for the same reason the audience block is: this is the only place the
 * model is told which words carry the position, which are the enemy's, and
 * which questions it may not answer. The `## Open rulings` list in particular
 * is the difference between a draft that leaves a question open and one that
 * silently decides it.
 */

const POSITIONING = {
  category: 'governed content pipeline for B2B SaaS',
  goal: 'become the default way marketing teams publish sourced content',
  promise: 'every article you publish can be defended line by line',
  activePosition: 'the content pipeline with a reviewer gate',
  statement: 'For marketing leads who need to publish, Acme is the pipeline that checks first',
  macroFrame: 'Generating text stopped being the hard part',
  landscape: 'Volume generators on one side, writing assistants on the other',
  coreClaims: [
    { claim: 'Every claim is sourced or labelled', evidenceRef: 'E1' },
    { claim: 'A person approves the angle before any spend', evidenceRef: '' },
    { claim: 'Every draft is scored before anyone sees it', evidenceRef: 'E7' },
  ],
  pillars: [
    {
      name: 'Governance',
      oneLine: 'one reviewer gate before anything costs money',
      carries: 'trust, cost control',
    },
    { name: 'Sourcing', oneLine: '', carries: 'credibility' },
  ],
  enemy: 'Volume-first "AI content" that publishes unsourced text',
  archetype: 'the Sage',
  essence: 'calm certainty',
  descriptorLadder: [
    { descriptor: 'software', note: 'for a stranger' },
    { descriptor: 'content platform', note: '' },
    { descriptor: 'governed content pipeline', note: 'for a buyer' },
  ],
  vocabularyReachFor: [
    { term: 'sourced', note: '' },
    { term: 'reviewer gate', note: 'nobody else has one' },
  ],
  vocabularyAvoid: [
    { term: 'AI-powered', note: 'says nothing' },
    { term: 'autopilot', note: "the enemy's word" },
  ],
  openRulings: [
    { question: 'Do we call ourselves a "CMS"?', status: 'open' as const, ruling: '', ruledAt: '' },
    {
      question: 'Do we say platform?',
      status: 'ruled' as const,
      ruling: 'No, it reads as generic',
      ruledAt: '2026-05-01T00:00:00.000Z',
    },
  ],
}

describe('positioningToPrompt', () => {
  it('renders the positioning block exactly', () => {
    assert.equal(
      positioningToPrompt(POSITIONING),
      [
        '# Positioning',
        'Category: governed content pipeline for B2B SaaS. Goal: become the default way marketing ' +
          'teams publish sourced content.',
        'Promise: every article you publish can be defended line by line.',
        'Position we occupy: "the content pipeline with a reviewer gate".',
        'Statement: For marketing leads who need to publish, Acme is the pipeline that checks first.',
        'Macro frame: Generating text stopped being the hard part.   Landscape: Volume generators ' +
          'on one side, writing assistants on the other.',
        '## Core claims (lean on these; cite the Evidence bank where a ref is given)',
        '1. Every claim is sourced or labelled. (see [E1])',
        '2. A person approves the angle before any spend.',
        '3. Every draft is scored before anyone sees it. (see [E7])',
        '## Pillars',
        '- Governance — one reviewer gate before anything costs money — carries: trust, cost control',
        '- Sourcing — carries: credibility',
        '## Enemy',
        'Volume-first "AI content" that publishes unsourced text.',
        '## Archetype and essence',
        'Archetype: the Sage. Essence: calm certainty.',
        '## How to describe us (broad → specific)',
        'software → content platform → governed content pipeline',
        '## Vocabulary',
        'Reach for: sourced, reviewer gate (nobody else has one). Avoid: AI-powered (says nothing), ' +
          "autopilot (the enemy's word).",
        '## Open rulings (take no position on these)',
        '- Do we call ourselves a "CMS"? (open)',
      ].join('\n'),
    )
  })

  it('sends only the open rulings, never a question the workspace has settled', () => {
    const block = positioningToPrompt(POSITIONING)
    assert.ok(!block.includes('Do we say platform?'))
    assert.ok(!block.includes('reads as generic'))
  })

  it('keeps the operator’s ladder notes out of the prompt', () => {
    const block = positioningToPrompt(POSITIONING)
    assert.ok(!block.includes('for a stranger'))
    assert.ok(!block.includes('for a buyer'))
  })

  it('renders a half-filled position with only the sections it has', () => {
    const partial = positioningToPrompt({
      ...emptyPositioningContent(),
      category: 'analytics for support teams',
      activePosition: 'the one that reads the tickets',
      pillars: [{ name: 'Evidence', oneLine: '', carries: '' }],
    })
    assert.equal(
      partial,
      [
        '# Positioning',
        'Category: analytics for support teams.',
        'Position we occupy: "the one that reads the tickets".',
        '## Pillars',
        '- Evidence',
      ].join('\n'),
    )
    for (const heading of [
      '## Core claims',
      '## Enemy',
      '## Archetype and essence',
      '## How to describe us',
      '## Vocabulary',
      '## Open rulings',
    ]) {
      assert.ok(!partial.includes(heading), `${heading} should have been omitted`)
    }
  })

  it('renders one half of a paired line without dangling the other', () => {
    const goalOnly = positioningToPrompt({
      ...emptyPositioningContent(),
      goal: 'own the category',
      landscape: 'crowded',
      vocabularyAvoid: [{ term: 'synergy', note: '' }],
    })
    assert.equal(
      goalOnly,
      [
        '# Positioning',
        'Goal: own the category.',
        'Landscape: crowded.',
        '## Vocabulary',
        'Avoid: synergy.',
      ].join('\n'),
    )
  })

  it('renders nothing at all for a workspace that has saved no position', () => {
    assert.equal(positioningToPrompt(null), '')
    assert.equal(positioningToPrompt(undefined), '')
    assert.equal(positioningToPrompt(emptyPositioningContent()), '')
  })

  it('renders the same string twice, so a prompt snapshot is comparable', () => {
    assert.equal(positioningToPrompt(POSITIONING), positioningToPrompt(POSITIONING))
    assert.equal(positioningToPrompt(POSITIONING_FIXTURE), positioningToPrompt(POSITIONING_FIXTURE))
  })

  it('does not double a full stop the operator already typed', () => {
    const block = positioningToPrompt({
      ...emptyPositioningContent(),
      category: 'analytics.',
      enemy: 'Guesswork!',
    })
    assert.ok(block.includes('Category: analytics.\n'))
    assert.ok(!block.includes('analytics..'))
    assert.ok(block.includes('Guesswork!'))
    assert.ok(!block.includes('Guesswork!.'))
  })
})

/**
 * What the writer is shown about the workspace's own facts.
 *
 * A golden string for the same reason as the audience block: this is the only
 * thing standing between a draft and an invented customer count, and a change
 * to the wording is a change to what the model believes it is allowed to say.
 */
describe('the evidence bank block', () => {
  it('renders the demo bank exactly', () => {
    assert.equal(
      evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, {
        asOf: '2026-09-02',
        surface: 'web',
        companyName: 'Datum',
      }),
      [
        '# Evidence bank (the only first-party facts you may state about Datum)',
        'Cite the ref after the sentence that uses it. Stay within "Limits".',
        '- [E1] A reviewer approves the brief before any drafting is paid for, on every article. ' +
          'Source: Datum pipeline audit export, 2026-08-01. Method: Every article created in the ' +
          '2026 H1 window; the status machine has no path from research to drafting that skips ' +
          'brief approval. Limits: Describes the product, not customer behaviour; it does not say ' +
          'reviewers read the brief carefully. Cleared: web, blog.',
        '- [E2] Every published draft carries a stored fact check, style review, and ' +
          'information-gain score. Source: Datum QA schema and article audit trail, 2026-07-15. ' +
          'Method: The publish gate refuses an article whose QA results are absent. Limits: A ' +
          'stored check is not a passing check; some articles are published after a reviewer ' +
          'overrides one.',
        '- [E3] The median article costs under two dollars of model spend from research to scored ' +
          'draft. Source: Cost-log export, 2026 Q2, 2026-07-01. Method: Median of all cost-log ' +
          'rows grouped by article across one quarter, mock runs excluded. Limits: Median, not ' +
          'typical: a regenerated article costs several times this. Excludes Ahrefs and hosting. ' +
          'Cleared: web, blog, sales.',
        '- [F4] Datum stores its content in Payload CMS on Postgres, and publishes through ' +
          'Next.js. (fact; owner: engineering; confirmed 2026-08-20)',
        '- [F5] Datum runs entirely inside a customer’s own deployment; no article text leaves it ' +
          'except to the model provider. (fact; owner: engineering; confirmed 2026-08-20)',
        '',
        '## Never state these',
        '- [R6] "Datum guarantees your articles will rank" — rejected: Nobody can guarantee a ' +
          'ranking, and the promise is about defensibility rather than placement. Say instead: [E1].',
      ].join('\n'),
    )
  })

  it('renders the same string twice, so a prompt snapshot is comparable', () => {
    const opts = { asOf: '2026-09-02', surface: 'web', companyName: 'Datum' }
    assert.equal(
      evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, opts),
      evidenceBankToPrompt(EVIDENCE_BANK_FIXTURE, opts),
    )
  })
})
