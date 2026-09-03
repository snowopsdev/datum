import assert from 'node:assert/strict'
import test from 'node:test'

import { buildBrief, parseBrief } from '../src/brief'
import { emptyIcpContent } from '../src/tenant'

const facets = [
  { label: 'Cleaning cycle', description: 'Daily backflush.', mustHave: true, docCount: 3 },
  { label: 'Water hardness', description: 'Use filtered water.', mustHave: false, docCount: 2 },
] as never
const gaps = [
  {
    label: 'Descaling frequency',
    description: 'Nobody says how often for a given hardness.',
    evidenceHint: 'the maker\'s service manual',
  },
] as never

test('buildBrief puts template sections first, then one section per research gap', () => {
  const brief = buildBrief({
    keyword: 'espresso machine maintenance',
    templateIntent: 'A step-by-step guide that gets the reader to a working result',
    requiredSections: ['What you need', 'Step-by-step instructions'],
    facets,
    gaps,
    brandVoice: null,
    icp: null,
  })
  assert.equal(
    brief.angle,
    'A step-by-step guide that gets the reader to a working result for "espresso machine maintenance"',
  )
  assert.deepEqual(
    brief.sections.map((s) => [s.heading, s.source]),
    [
      ['What you need', 'template'],
      ['Step-by-step instructions', 'template'],
      ['Descaling frequency', 'research'],
    ],
  )
  assert.equal(brief.sections[0].notes, '')
  assert.match(brief.sections[2].notes, /Nobody says how often/)
  assert.match(brief.sections[2].notes, /Evidence: the maker's service manual/)
  assert.deepEqual(brief.mustCover, ['Cleaning cycle', 'Water hardness'])
  assert.deepEqual(brief.opportunities, ['Descaling frequency'])
  assert.equal(brief.notes, '')
})

test('buildBrief takes the audience from the brand voice when there is one', () => {
  const brief = buildBrief({
    keyword: 'x',
    templateIntent: null,
    requiredSections: [],
    facets: [],
    gaps: [],
    brandVoice: {
      audience: { description: 'Home baristas.', needs: 'Fewer wasted shots.', interests: '', languageLevel: null },
    } as never,
    icp: null,
  })
  assert.equal(brief.audience, 'Home baristas. Needs: Fewer wasted shots.')
  // No intent on the template still yields a usable angle.
  assert.equal(brief.angle, 'An article about "x"')
})

test('parseBrief drops malformed rows and defaults an unknown source to editor', () => {
  const parsed = parseBrief({
    angle: '  angle  ',
    sections: [
      { heading: 'Keep', notes: 'n', source: 'research' },
      { heading: '', notes: 'dropped: no heading' },
      'not a row',
      { heading: 'Added by hand', source: 'something-else' },
    ],
    mustCover: ['a', 3, '', 'b'],
    notes: 42,
  })
  assert.ok(parsed)
  assert.equal(parsed.angle, 'angle')
  assert.deepEqual(
    parsed.sections.map((s) => [s.heading, s.source]),
    [
      ['Keep', 'research'],
      ['Added by hand', 'editor'],
    ],
  )
  assert.deepEqual(parsed.mustCover, ['a', 'b'])
  assert.equal(parsed.notes, '')
})

test('parseBrief returns null for nothing at all', () => {
  assert.equal(parseBrief(null), null)
  assert.equal(parseBrief('x'), null)
})

/**
 * The audience line.
 *
 * The brand voice's audience describes everyone the brand talks to; the ICP
 * describes the one group this piece is aimed at. When both exist the ICP wins,
 * because a brief that says "home baristas" for a piece aimed at café owners is
 * a brief the editor has to correct by hand every time.
 */
const ICP = {
  ...emptyIcpContent('Café owners'),
  id: 3,
  who: 'Owners of one or two independent cafés',
  pains: [
    { statement: 'Staff pull inconsistent shots', evidence: [], confidence: null },
    { statement: 'A second pain that is not the headline', evidence: [], confidence: null },
  ],
}

const voice = {
  audience: {
    description: 'Home baristas.',
    needs: 'Fewer wasted shots.',
    interests: '',
    languageLevel: null,
  },
} as never

const briefWith = (icp: Parameters<typeof buildBrief>[0]['icp'], brandVoice: never | null) =>
  buildBrief({
    keyword: 'x',
    templateIntent: null,
    requiredSections: [],
    facets: [],
    gaps: [],
    brandVoice,
    icp,
  })

test('buildBrief takes the audience from the ICP when there is one', () => {
  assert.equal(
    briefWith(ICP, voice).audience,
    'Owners of one or two independent cafés. Main pain: Staff pull inconsistent shots.',
  )
})

test('buildBrief falls back to the brand voice, then to nothing at all', () => {
  assert.equal(briefWith(null, voice).audience, 'Home baristas. Needs: Fewer wasted shots.')
  assert.equal(briefWith(null, null).audience, '')
  // An ICP with nothing usable in it is the same as no ICP: the voice answers.
  assert.equal(briefWith(emptyIcpContent('Nameless'), voice).audience, 'Home baristas. Needs: Fewer wasted shots.')
})
