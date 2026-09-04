import assert from 'node:assert/strict'
import test from 'node:test'

import { BRAND_VOICE_FIXTURE } from '../../cms/src/lib/brandVoiceFixture'
import type { Article, Template } from '../../cms/src/payload-types'
import { bannedWordsOf } from '../src/brandVoice'
import { buildPrompt, buildSystemPrompt } from '../src/generatePrompt'
import { runStructuralChecks } from '../src/qa/structuralChecks'
import { markdownToLexical } from '../src/richtext'
import { loadStyleGuide } from '../src/styleGuide'
import { emptyTenantContext } from '../src/tenant'

const styleGuide = loadStyleGuide()

const template: Template = {
  id: 1,
  name: 'Test template',
  requiredSections: [],
  seoSpec: { titleTagMaxLength: 60, metaDescriptionMaxLength: 160 },
  updatedAt: '2026-08-21T00:00:00.000Z',
  createdAt: '2026-08-21T00:00:00.000Z',
}

function makeArticle(overrides: Partial<Article>): Article {
  return {
    id: 42,
    keyword: 'test keyword',
    title: 'How to pick a tool',
    titleTag: 'How to pick a tool that fits your team',
    metaDescription: 'Pick the right tool for your team in under an hour.',
    ogTitle: 'How to pick a tool',
    ogDescription: 'A short, plain guide to picking the right tool.',
    ogImage: 'https://example.com/og/tool.jpg',
    body: markdownToLexical('## Introduction\nA plain intro that answers the question.') as Article['body'],
    status: 'drafted',
    updatedAt: '2026-08-21T00:00:00.000Z',
    createdAt: '2026-08-21T00:00:00.000Z',
    ...overrides,
  }
}

test('generate prompts carry the brand voice and samples only when one is active', () => {
  const article = makeArticle({})
  const withVoice = buildPrompt(article, template, BRAND_VOICE_FIXTURE, emptyTenantContext())
  assert.ok(withVoice.includes('# On-voice writing samples'))
  assert.ok(withVoice.includes('Every field must follow the brand voice'))

  const without = buildPrompt(article, template, null, emptyTenantContext())
  assert.ok(!without.includes('# On-voice writing samples'))
  assert.ok(!without.includes('Every field must follow the brand voice'))

  const tenant = emptyTenantContext()
  const system = buildSystemPrompt(styleGuide.text, BRAND_VOICE_FIXTURE, tenant, null)
  assert.ok(system.startsWith('You are a senior content writer.'))
  assert.ok(system.includes('# Brand voice (tenant)'))
  assert.ok(
    !buildSystemPrompt(styleGuide.text, null, tenant, null).includes('# Brand voice (tenant)'),
  )
})

test('brand banned words are flagged in body and metaDescription with source brand', () => {
  const brandBannedWords = bannedWordsOf(BRAND_VOICE_FIXTURE)
  assert.ok(brandBannedWords.includes('synergy'))
  const article = makeArticle({
    body: markdownToLexical('## Introduction\nWe found real Synergy between the tools.') as Article['body'],
    metaDescription: 'A world-class guide to picking tools.',
  })
  const violations = runStructuralChecks(article, template, styleGuide, { brandBannedWords })
  const banned = violations.filter((v) => v.code === 'BANNED_PHRASE')
  assert.deepEqual(
    banned.map((v) => [v.field, v.phrase, v.source]),
    [
      ['body', 'synergy', 'brand'],
      ['metaDescription', 'world-class', 'brand'],
    ],
  )
})

test('og fields are scanned and platform phrases keep source platform', () => {
  assert.ok(styleGuide.bannedPhrases.includes('game-changer'))
  const article = makeArticle({ ogDescription: 'This tool is a game-changer for teams.' })
  const violations = runStructuralChecks(article, template, styleGuide, {
    brandBannedWords: bannedWordsOf(BRAND_VOICE_FIXTURE),
  })
  const banned = violations.filter((v) => v.code === 'BANNED_PHRASE')
  assert.deepEqual(
    banned.map((v) => [v.field, v.phrase, v.source]),
    [['ogDescription', 'game-changer', 'platform']],
  )
})

test('a word banned by both platform and brand is reported once, as platform', () => {
  const article = makeArticle({ title: 'A game-changer for teams' })
  const violations = runStructuralChecks(article, template, styleGuide, {
    brandBannedWords: ['Game-Changer', 'synergy'],
  })
  const banned = violations.filter((v) => v.code === 'BANNED_PHRASE')
  assert.equal(banned.length, 1)
  assert.equal(banned[0].source, 'platform')
})

test('without brand options the checks behave as before', () => {
  const violations = runStructuralChecks(makeArticle({}), template, styleGuide)
  assert.deepEqual(violations, [])
})
