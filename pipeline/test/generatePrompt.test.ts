import assert from 'node:assert/strict'
import test from 'node:test'

import type { Article, Template } from '../../cms/src/payload-types'
import { buildPrompt, gapsBlock } from '../src/generatePrompt'
import { markdownToLexical } from '../src/richtext'

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
  const sections = gapsBlock({ ...baseResearch, facets, gaps })
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
  const many = gapsBlock({ ...baseResearch, facets: [{ ...facets[0], docCount: 3 }] }).join('\n\n')
  assert.ok(many.includes('(covered by 3 baseline sources)'))
  const one = gapsBlock({ ...baseResearch, facets: [{ ...facets[0], docCount: 1 }] }).join('\n\n')
  assert.ok(one.includes('(covered by 1 baseline source)'))
  assert.ok(!one.includes('1 baseline sources'))
})

test('gapsBlock reproduces the evidence rules verbatim', () => {
  const text = gapsBlock({ ...baseResearch, facets, gaps }).join('\n\n')
  assert.ok(
    text.includes(
      "Do not invent unique insights. Add a novel factual claim only when you can name the public source (organisation and document) a fact-checker could find; otherwise state it as an explicitly labelled inference (for example, 'In our reading of the guidance…'). Never present first-party measurements, tests, surveys, or datasets — Datum has none. Prefer covering every consensus facet over adding novelty. Every number, date, and percentage must be one you can attribute.",
    ),
  )
})

test('gapsBlock emits the evidence rules when only gaps exist', () => {
  const text = gapsBlock({ ...baseResearch, gaps }).join('\n\n')
  assert.ok(!text.includes('# Consensus facets (must cover)'))
  assert.ok(text.includes('# Information gaps (opportunities)'))
  assert.ok(text.includes('# Evidence rules'))
})

test('gapsBlock is empty with no facets and no gaps', () => {
  assert.deepEqual(gapsBlock(baseResearch), [])
  assert.deepEqual(gapsBlock({ ...baseResearch, facets: [], gaps: [] }), [])
  assert.deepEqual(gapsBlock(undefined), [])
})

test('gapsBlock renders revision notes with the closing line', () => {
  const text = gapsBlock(baseResearch, 'Section 3 cites nothing.').join('\n\n')
  assert.ok(text.includes('# Revision notes (previous attempt)'))
  assert.ok(text.includes('Section 3 cites nothing.'))
  assert.ok(text.includes('Fix these before anything else.'))
})

test('gapsBlock ignores blank revision notes', () => {
  assert.deepEqual(gapsBlock(baseResearch, '   '), [])
  assert.deepEqual(gapsBlock(baseResearch, null), [])
})

test('buildPrompt puts the gaps block before the Output section', () => {
  const article = makeArticle(
    { ...baseResearch, facets, gaps },
    {
      revisionNotes: 'Cite the pricing page.',
    },
  )
  const prompt = buildPrompt(article, template, null)
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
  const prompt = buildPrompt(makeArticle(baseResearch), template, null)
  assert.ok(!prompt.includes('# Consensus facets (must cover)'))
  assert.ok(!prompt.includes('# Information gaps (opportunities)'))
  assert.ok(!prompt.includes('# Evidence rules'))
  assert.ok(!prompt.includes('# Revision notes (previous attempt)'))
})
