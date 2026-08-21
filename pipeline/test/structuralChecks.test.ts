import assert from 'node:assert/strict'
import test from 'node:test'

import type { Article, Template } from '../../cms/src/payload-types'
import { runStructuralChecks } from '../src/qa/structuralChecks'
import { markdownToLexical } from '../src/richtext'
import { loadStyleGuide } from '../src/styleGuide'

const styleGuide = loadStyleGuide()

const template: Template = {
  id: 1,
  name: 'Test template',
  outline: markdownToLexical('## Introduction\nOpen with the answer.\n## FAQ\nThree to four questions.') as Template['outline'],
  seoSpec: {
    titleTagMaxLength: 60,
    metaDescriptionMaxLength: 160,
    faqRequired: true,
    faqMinQuestions: 2,
    faqMaxQuestions: 4,
    ogTagsRequired: true,
  },
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
}

const cleanBody = [
  '## Introduction',
  'This guide shows you how to pick a tool that fits your team. It takes about an hour to compare the top options.',
  '## FAQ',
  'The questions below cover what most readers ask first.',
].join('\n')

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: 42,
    keyword: 'test keyword',
    title: 'How to pick a tool',
    titleTag: 'How to pick a tool that fits your team',
    metaDescription: 'Pick the right tool for your team in under an hour with this short, plain guide.',
    ogTitle: 'How to pick a tool',
    ogDescription: 'A short, plain guide to picking the right tool.',
    ogImage: 'https://example.com/og/tool.jpg',
    faqItems: [
      { question: 'How long does this take?', answer: 'About an hour for most teams.' },
      { question: 'Does it cost anything?', answer: 'No. Every step uses free trials.' },
    ],
    body: markdownToLexical(cleanBody) as Article['body'],
    status: 'drafted',
    updatedAt: '2026-08-21T00:00:00.000Z',
    createdAt: '2026-08-21T00:00:00.000Z',
    ...overrides,
  }
}

test('clean article produces zero violations', () => {
  const violations = runStructuralChecks(makeArticle({}), template, styleGuide)
  assert.deepEqual(violations, [])
})

test('over-long titleTag is flagged with limit and actual', () => {
  const longTitleTag = 'How to pick a tool that fits your team without wasting a whole quarter on it'
  const violations = runStructuralChecks(makeArticle({ titleTag: longTitleTag }), template, styleGuide)
  const violation = violations.find((v) => v.code === 'TITLE_TAG_TOO_LONG')
  assert.ok(violation, 'expected TITLE_TAG_TOO_LONG')
  assert.equal(violation.limit, 60)
  assert.equal(violation.actual, longTitleTag.length)
})

test('banned phrase from docs/style-guide.md is found case-insensitively, once per occurrence', () => {
  // "game-changer" is a real entry under "## Banned phrases".
  assert.ok(styleGuide.bannedPhrases.includes('game-changer'))
  const body = [
    '## Introduction',
    'This tool is a Game-Changer for small teams. Some even call it a game-changer twice.',
    '## FAQ',
    'The questions below cover the basics.',
  ].join('\n')
  const violations = runStructuralChecks(
    makeArticle({ body: markdownToLexical(body) as Article['body'] }),
    template,
    styleGuide,
  )
  const banned = violations.filter((v) => v.code === 'BANNED_PHRASE')
  assert.equal(banned.length, 2)
  assert.ok(banned.every((v) => v.phrase === 'game-changer' && v.field === 'body'))
})

test('two H1s in the body trigger a HEADING_STRUCTURE multiple_h1 violation', () => {
  const body = [
    '# First big heading',
    'Some intro text.',
    '# Second big heading',
    '## Introduction',
    'The intro paragraph.',
    '## FAQ',
    'The questions below cover the basics.',
  ].join('\n')
  const violations = runStructuralChecks(
    makeArticle({ title: null, body: markdownToLexical(body) as Article['body'] }),
    template,
    styleGuide,
  )
  const heading = violations.filter((v) => v.code === 'HEADING_STRUCTURE')
  assert.ok(
    heading.some((v) => v.problem === 'multiple_h1'),
    `expected multiple_h1, got ${JSON.stringify(heading)}`,
  )
})

test('FAQ count outside the template range is flagged', () => {
  const violations = runStructuralChecks(
    makeArticle({ faqItems: [{ question: 'Only one?', answer: 'Yes.' }] }),
    template,
    styleGuide,
  )
  const violation = violations.find((v) => v.code === 'FAQ_COUNT_OUT_OF_RANGE')
  assert.ok(violation, 'expected FAQ_COUNT_OUT_OF_RANGE')
  assert.equal(violation.min, 2)
  assert.equal(violation.max, 4)
  assert.equal(violation.actual, 1)

  const tooMany = runStructuralChecks(
    makeArticle({
      faqItems: Array.from({ length: 5 }, (_, i) => ({
        question: `Question ${i + 1}?`,
        answer: 'A short answer.',
      })),
    }),
    template,
    styleGuide,
  )
  const over = tooMany.find((v) => v.code === 'FAQ_COUNT_OUT_OF_RANGE')
  assert.ok(over, 'expected FAQ_COUNT_OUT_OF_RANGE for too many items')
  assert.equal(over.actual, 5)
})
