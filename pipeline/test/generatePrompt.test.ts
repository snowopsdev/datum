import assert from 'node:assert/strict'
import test from 'node:test'

import { BRAND_VOICE_FIXTURE } from '../../cms/src/lib/brandVoiceFixture'
import type { Article, Template } from '../../cms/src/payload-types'
import { briefBlock, buildPrompt, buildSystemPrompt, gapsBlock } from '../src/generatePrompt'
import { markdownToLexical } from '../src/richtext'
import {
  emptyIcpContent,
  emptyTenantContext,
  evidenceRules,
  resolveWorkspaceProfile,
  type TenantContext,
} from '../src/tenant'
import { EVIDENCE_BANK_FIXTURE, POSITIONING_FIXTURE } from '../../cms/src/lib/tenant/fixtures'

/** A tenant that knows who it is and what it may say about itself. */
const withBank = (): TenantContext => ({
  ...emptyTenantContext('2026-09-02'),
  profile: resolveWorkspaceProfile({ companyName: 'Acme Analytics' }, {}),
  evidenceBank: EVIDENCE_BANK_FIXTURE,
})

/** The same workspace, before anybody wrote a bank. */
const namedOnly = (): TenantContext => ({
  ...emptyTenantContext('2026-09-02'),
  profile: resolveWorkspaceProfile({ companyName: 'Acme Analytics' }, {}),
})

const template: Template = {
  id: 1,
  name: 'How-To',
  requiredSections: [],
  seoSpec: { titleTagMaxLength: 60, metaDescriptionMaxLength: 160 },
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
}

const facets = [
  {
    id: 'f1',
    label: 'Pricing tiers',
    description: 'What each tier costs and what it includes.',
    weight: 0.5,
    docCount: 1,
    mustHave: false,
    claimIds: ['b1-1'],
  },
  {
    id: 'f2',
    label: 'Migration steps',
    description: 'The order the migration is carried out in.',
    weight: 0.3,
    docCount: 4,
    mustHave: true,
    claimIds: ['b2-1'],
  },
]

const gaps = [
  {
    facetId: 'f1',
    label: 'Seat minimums',
    description: 'No page states the minimum seat count per tier.',
    evidenceHint: 'The vendor pricing page.',
  },
]

function makeArticle(research: Article['research'], overrides: Partial<Article> = {}): Article {
  return {
    id: 42,
    keyword: 'crm migration',
    status: 'researched',
    body: markdownToLexical('## Intro\nText.') as Article['body'],
    research,
    updatedAt: '2026-08-21T00:00:00.000Z',
    createdAt: '2026-08-21T00:00:00.000Z',
    ...overrides,
  }
}

const baseResearch = {
  rankingPagesSummary: '1. Example (example.com)',
  commonSubtopics: [{ text: 'cost' }],
  relatedQuestions: [{ text: 'how long does it take?' }],
}

test('gapsBlock renders facets, gaps, and the evidence rules', () => {
  const sections = gapsBlock({ ...baseResearch, facets, gaps }, emptyTenantContext())
  const text = sections.join('\n\n')
  assert.ok(text.includes('# Consensus facets (must cover)'))
  assert.ok(text.includes('# Information gaps (opportunities)'))
  assert.ok(text.includes('# Evidence rules'))
  assert.ok(
    text.includes(
      '- Migration steps (required by template): The order the migration is carried out in.',
    ),
  )
  assert.ok(
    text.includes(
      '- Pricing tiers (covered by 1 baseline source): What each tier costs and what it includes.',
    ),
  )
  assert.ok(
    text.includes(
      '- Seat minimums: No page states the minimum seat count per tier. Evidence that would settle it: The vendor pricing page.',
    ),
  )
})

test('gapsBlock pluralises docCount', () => {
  const many = gapsBlock({ ...baseResearch, facets: [{ ...facets[0], docCount: 3 }] }, emptyTenantContext()).join('\n\n')
  assert.ok(many.includes('(covered by 3 baseline sources)'))
  const one = gapsBlock({ ...baseResearch, facets: [{ ...facets[0], docCount: 1 }] }, emptyTenantContext()).join('\n\n')
  assert.ok(one.includes('(covered by 1 baseline source)'))
  assert.ok(!one.includes('1 baseline sources'))
})

/**
 * The rules are the workspace's, not the platform's.
 *
 * `EVIDENCE_RULES` used to hard-code "Datum has none", which was a statement
 * about the company that happened to be building this and was wrong for every
 * other tenant. What replaces it names the company and changes with the bank.
 */
test('gapsBlock reproduces the evidence rules for a workspace with no bank', () => {
  const text = gapsBlock({ ...baseResearch, facets, gaps }, emptyTenantContext()).join('\n\n')
  assert.ok(text.includes(evidenceRules('', false)))
  assert.ok(!text.includes('Datum has none'))
})

test('gapsBlock emits the evidence rules when only gaps exist', () => {
  const text = gapsBlock({ ...baseResearch, gaps }, emptyTenantContext()).join('\n\n')
  assert.ok(!text.includes('# Consensus facets (must cover)'))
  assert.ok(text.includes('# Information gaps (opportunities)'))
  assert.ok(text.includes('# Evidence rules'))
})

test('gapsBlock is empty with no facets and no gaps', () => {
  assert.deepEqual(gapsBlock(baseResearch, emptyTenantContext()), [])
  assert.deepEqual(gapsBlock({ ...baseResearch, facets: [], gaps: [] }, emptyTenantContext()), [])
  assert.deepEqual(gapsBlock(undefined, emptyTenantContext()), [])
})

test('gapsBlock renders revision notes with the closing line', () => {
  const text = gapsBlock(baseResearch, emptyTenantContext(), 'Section 3 cites nothing.').join('\n\n')
  assert.ok(text.includes('# Revision notes (previous attempt)'))
  assert.ok(text.includes('Section 3 cites nothing.'))
  assert.ok(text.includes('Fix these before anything else.'))
})

test('gapsBlock ignores blank revision notes', () => {
  assert.deepEqual(gapsBlock(baseResearch, emptyTenantContext(), '   '), [])
  assert.deepEqual(gapsBlock(baseResearch, emptyTenantContext(), null), [])
})

test('buildPrompt puts the gaps block before the Output section', () => {
  const article = makeArticle(
    { ...baseResearch, facets, gaps },
    {
      revisionNotes: 'Cite the pricing page.',
    },
  )
  const prompt = buildPrompt(article, template, null, emptyTenantContext())
  const output = prompt.indexOf('# Output')
  assert.ok(output > -1)
  for (const heading of [
    '# Consensus facets (must cover)',
    '# Information gaps (opportunities)',
    '# Evidence rules',
    '# Revision notes (previous attempt)',
  ]) {
    const at = prompt.indexOf(heading)
    assert.ok(at > -1, `${heading} missing`)
    assert.ok(at < output, `${heading} must precede # Output`)
  }
  assert.ok(prompt.indexOf('# SERP research') < prompt.indexOf('# Consensus facets (must cover)'))
})

test('buildPrompt omits the gaps block when research has none', () => {
  const prompt = buildPrompt(makeArticle(baseResearch), template, null, emptyTenantContext())
  assert.ok(!prompt.includes('# Consensus facets (must cover)'))
  assert.ok(!prompt.includes('# Information gaps (opportunities)'))
  assert.ok(!prompt.includes('# Evidence rules'))
  assert.ok(!prompt.includes('# Revision notes (previous attempt)'))
})

test('briefBlock renders the editor\'s brief with their notes ranked above the outline', () => {
  const [block] = briefBlock({
    angle: 'A step-by-step guide for "espresso maintenance"',
    audience: 'Home baristas.',
    sections: [
      { heading: 'What you need', notes: '', source: 'template' },
      { heading: 'Descaling frequency', notes: 'Cite the maker.', source: 'research' },
      { heading: 'Our pick', notes: 'Keep it short.', source: 'editor' },
    ],
    mustCover: ['Cleaning cycle', 'Water hardness'],
    opportunities: ['Descaling frequency'],
    notes: 'Lead with the weekly routine, not the theory.',
  })
  assert.match(block, /^# Brief \(approved by the editor\)/)
  assert.match(block, /Angle: A step-by-step guide/)
  assert.match(block, /Audience: Home baristas\./)
  assert.match(block, /- What you need \(required section\)/)
  assert.match(block, /- Descaling frequency: Cite the maker\./)
  assert.match(block, /- Our pick: Keep it short\./)
  assert.match(block, /Must cover: Cleaning cycle; Water hardness/)
  assert.match(block, /follow this over the template outline where they conflict:\nLead with the weekly routine/)
})

test('briefBlock is empty when there is no brief, so older articles generate as before', () => {
  assert.deepEqual(briefBlock(null), [])
  assert.deepEqual(briefBlock(undefined), [])
  assert.deepEqual(briefBlock({ angle: '', sections: [], mustCover: [], opportunities: [], notes: '' }), [])
})

test('buildPrompt carries the template example into the prompt, before the Output section', () => {
  const withExample: Template = {
    ...template,
    example: markdownToLexical('## How to Watch Memphis at UNLV\n\nKickoff is 10 p.m. ET.'),
  }
  const prompt = buildPrompt(makeArticle(baseResearch), withExample, null, emptyTenantContext())
  const at = prompt.indexOf('## Example')
  assert.ok(at > -1, '## Example missing')
  assert.ok(at < prompt.indexOf('# Output'), '## Example must precede # Output')
  assert.match(prompt, /How to Watch Memphis at UNLV/)
  // The example is a different article; its facts must not be treated as this
  // draft's, or they reach the information-gain stage unsourced.
  assert.match(prompt, /do not carry over any of its facts/)
})

test('buildPrompt omits the Example heading when the template has none', () => {
  const prompt = buildPrompt(makeArticle(baseResearch), template, null, emptyTenantContext())
  assert.ok(!prompt.includes('## Example'))
})

/**
 * The system prompt's block order.
 *
 * Order matters to the model: the workspace establishes whose market the later
 * blocks are about, and the audience is read as a constraint on the voice
 * rather than a replacement for it. Pinned here so a refactor that reorders the
 * concatenation is a visible change, not a silent one.
 */
const tenantFor = (overrides: Partial<Parameters<typeof buildSystemPrompt>[2]> = {}) => ({
  ...emptyTenantContext(),
  profile: resolveWorkspaceProfile(
    { companyName: 'Acme Analytics', targetDomain: 'acme.example' },
    {},
  ),
  ...overrides,
})

const AUDIENCE = {
  ...emptyIcpContent('Growth marketer'),
  who: 'Owns the blog',
  pains: [{ statement: 'Briefs take a day', evidence: [], confidence: null }],
}

test('buildSystemPrompt orders style guide, workspace, brand voice, audience, then positioning', () => {
  const prompt = buildSystemPrompt(
    'STYLE GUIDE TEXT',
    BRAND_VOICE_FIXTURE,
    tenantFor({ positioning: POSITIONING_FIXTURE }),
    AUDIENCE,
  )
  const at = (needle: string) => {
    const index = prompt.indexOf(needle)
    assert.notEqual(index, -1, `${needle} is missing from the system prompt`)
    return index
  }
  assert.ok(prompt.startsWith('You are a senior content writer.'))
  assert.ok(at('STYLE GUIDE TEXT') < at('# Workspace'))
  assert.ok(at('# Workspace') < at('# Brand voice (tenant)'))
  assert.ok(at('# Brand voice (tenant)') < at('# Audience: Growth marketer'))
  assert.ok(at('# Audience: Growth marketer') < at('# Positioning'))
  // The position's own words reach the writer, not just its heading.
  assert.match(prompt, /Position we occupy: "the content pipeline with a reviewer gate"/)
  assert.match(prompt, /## Open rulings \(take no position on these\)/)
})

test('buildSystemPrompt sends no positioning block for a workspace that has none', () => {
  const prompt = buildSystemPrompt('STYLE GUIDE TEXT', BRAND_VOICE_FIXTURE, tenantFor(), AUDIENCE)
  assert.ok(!prompt.includes('# Positioning'))
  assert.ok(!prompt.includes('\n\n\n'))
})

test('buildSystemPrompt omits every block it has nothing for, leaving no blank gaps', () => {
  const bare = buildSystemPrompt('STYLE GUIDE TEXT', null, emptyTenantContext(), null)
  assert.equal(bare, 'You are a senior content writer. Follow this style guide exactly:\n\nSTYLE GUIDE TEXT')

  // A workspace but no voice and no audience: one block, not three headings.
  const workspaceOnly = buildSystemPrompt('STYLE GUIDE TEXT', null, tenantFor(), null)
  assert.match(workspaceOnly, /# Workspace/)
  assert.ok(!workspaceOnly.includes('# Brand voice (tenant)'))
  assert.ok(!workspaceOnly.includes('# Audience:'))
  assert.ok(!workspaceOnly.includes('# Positioning'))
  assert.ok(!workspaceOnly.includes('\n\n\n'))

  // A position and nothing else: the block still stands alone cleanly.
  const positioningOnly = buildSystemPrompt(
    'STYLE GUIDE TEXT',
    null,
    { ...emptyTenantContext(), positioning: POSITIONING_FIXTURE },
    null,
  )
  assert.match(positioningOnly, /# Positioning/)
  assert.ok(!positioningOnly.includes('# Workspace'))
  assert.ok(!positioningOnly.includes('\n\n\n'))
})

// ---------------------------------------------------------------------------
// Evidence rules and the bank block
// ---------------------------------------------------------------------------

/**
 * The first-party boundary is not a consequence of having done corpus research.
 *
 * The rules used to ride along with the facets, so a pre-snapshot article — one
 * generated before research ever captured a baseline — was free to invent a
 * customer count with nothing in the prompt to stop it.
 */
test('the evidence rules are sent for a named workspace even with no facets and no gaps', () => {
  const prompt = buildPrompt(makeArticle(baseResearch), template, null, namedOnly())
  assert.ok(prompt.includes('# Evidence rules'))
  assert.ok(prompt.includes(evidenceRules('Acme Analytics', false)))
  assert.ok(!prompt.includes('# Consensus facets (must cover)'))
  assert.ok(!prompt.includes('# Evidence bank'))
})

test('a workspace with nothing saved at all still sends no evidence rules without facets', () => {
  const prompt = buildPrompt(makeArticle(baseResearch), template, null, emptyTenantContext())
  assert.ok(!prompt.includes('# Evidence rules'))
})

test('the bank block follows the rules that point at it, and precedes the output spec', () => {
  const prompt = buildPrompt(makeArticle(baseResearch), template, null, withBank())
  const rules = prompt.indexOf('# Evidence rules')
  const bank = prompt.indexOf('# Evidence bank')
  const output = prompt.indexOf('# Output')
  assert.ok(rules > -1 && bank > -1 && output > -1)
  assert.ok(rules < bank, 'the rules say "the Evidence bank below"')
  assert.ok(bank < output)
  assert.ok(prompt.indexOf('# SERP research') < rules)
  assert.ok(prompt.includes(evidenceRules('Acme Analytics', true)))
  assert.ok(prompt.includes('[E1]'))
  assert.ok(prompt.includes('## Never state these'))
  assert.ok(!prompt.includes('Datum has none'))
})

test('the bank block still lands ahead of the revision notes on a regeneration', () => {
  const article = makeArticle({ ...baseResearch, facets, gaps }, {
    revisionNotes: 'Cite the pricing page.',
  })
  const prompt = buildPrompt(article, template, null, withBank())
  assert.ok(prompt.indexOf('# Evidence bank') < prompt.indexOf('# Revision notes (previous attempt)'))
  assert.ok(prompt.indexOf('# Revision notes (previous attempt)') < prompt.indexOf('# Output'))
})

/**
 * Asking for refs a workspace has no entries for teaches the model to invent
 * them, and an invented ref is a fabricated citation dressed as a checked one.
 */
test('the citation instruction is sent only when there is a bank to cite', () => {
  const instruction =
    'Put an evidence ref in square brackets at the end of any sentence that states a first-party fact, e.g. [E3].'
  assert.ok(buildPrompt(makeArticle(baseResearch), template, null, withBank()).includes(instruction))
  assert.ok(!buildPrompt(makeArticle(baseResearch), template, null, namedOnly()).includes(instruction))
})
