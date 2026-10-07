import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildBriefAnglePrompt, parseBriefAngles } from '../src/briefAngle'
import { emptyIcpContent, emptyTenantContext, emptyPositioningContent } from '../src/tenant'
import { BRAND_VOICE_FIXTURE } from '../../cms/src/lib/brandVoiceFixture'

const allowed = { pains: ['Wasting beans'], gapLabels: ['Water quality'] }
const option = { angle: 'Taste before spending more', rationale: 'Answer the pain', pain: 'Wasting beans', gaps: ['Water quality'] }
test('the parser keeps at most three valid options in order', () => {
  const rows = [option, {...option, angle: 'Second'}, {...option, angle: 'Third'}, {...option, angle: 'Fourth'}]
  assert.deepEqual(parseBriefAngles({angles: rows}, allowed), rows.slice(0, 3))
})
test('a pain copied the way the prompt shows it matches, and comes back as stored', () => {
  // The prompt renders pains with a full stop and a confidence tag; a model
  // that copies "verbatim" copies both.
  for (const pain of ['Wasting beans. [hypothesis]', '"wasting beans."', '  Wasting   beans  ', 'Wasting beans [strong directional]']) {
    assert.deepEqual(parseBriefAngles({angles: [{...option, pain}]}, allowed).map(o => o.pain), ['Wasting beans'], pain)
  }
})
test('a fragment of a pain is not that pain', () => {
  for (const pain of ['wasting', 'W', 'Wasting beans and time']) {
    assert.deepEqual(parseBriefAngles({angles: [{...option, pain}]}, allowed), [], pain)
  }
})
test('unknown pain, unknown gap and overlong angles are dropped', () => {
  assert.deepEqual(parseBriefAngles({angles: [{...option, pain: 'Made up'}, {...option, gaps: ['Made up']}, {...option, angle: 'x'.repeat(201)}]}, allowed), [])
})
test('malformed replies never throw or invent options', () => {
  for (const raw of [null, 'bad JSON', 42, [], {}, {angles: [null, 'x', {angle: 'x'}, {...option, gaps: 4}]}]) assert.deepEqual(parseBriefAngles(raw, allowed), [])
})
test('a hypothesis pain is allowed without policing the rationale grammar', () => {
  assert.equal(parseBriefAngles({angles: [option]}, allowed).length, 1)
})
test('the angle prompt pins its instructions and sends direction without evidence or voice samples', () => {
  const tenant = {...emptyTenantContext(), positioning: {...emptyPositioningContent(), category:'Espresso guides'}, profile: {...emptyTenantContext().profile, companyName: 'Coffee', targetDomain: 'coffee.example'}}
  const input = {keyword: 'espresso', secondaryKeywords: ['grinder'], templateName: 'Guide', templateIntent: 'Help choose', brandVoice: BRAND_VOICE_FIXTURE, icp: {...emptyIcpContent('Beginners'), pains: [{statement: 'Wasting beans', evidence: [], confidence: 'hypothesis' as const}]}, facets: [{label:'Budget', description:'Costs'}], gaps: [{label:'Water quality', description:'Taste'}], tenant, companyMentions: 'none' as const}
  const {system, user} = buildBriefAnglePrompt(input)
  assert.equal(system, 'Propose one to three editorial angles, each at most 200 characters, grounded in the supplied audience pains and research gaps. Return JSON only: {"angles":[{"angle":string,"rationale":string,"pain":string|null,"gaps":string[]}]}. Copy each pain statement exactly as written, without its confidence tag, and use only supplied gap labels. An angle resting on a [hypothesis] or [inference] pain must say so in its rationale. Respect the company-mentions rule. An angle is direction, not prose; invent no facts.')
  assert.equal(user, "Keyword: espresso\nSecondary keywords: grinder\nTemplate: Guide\nIntent: Help choose\n\n# Audience: Beginners\nThis is the reader for this piece. It narrows \"Who we are talking to\" in the brand voice; where the two differ, write for this reader.\nConfidence tags say how you may use a line: [verified]/[strong directional] state it plainly; [qualitative pattern]/[cultural signal] state it as a tendency, not a fact; [inference]/[hypothesis] attribute it to us, never as fact.\n\n## Pain\n- Wasting beans. [hypothesis]\n\n# Positioning\nCategory: Espresso guides.\n\n# Facets\n- Budget: Costs\n\n# Gaps\n- Water quality: Taste\n\n# Company mentions\nDo not name Coffee or describe its product anywhere in this piece, including the title, meta fields, and FAQ. Use the Audience and Positioning to choose the angle, the examples, and what the reader is told to care about, not as material to sell from.")
  assert.ok(user.startsWith('Keyword: espresso\nSecondary keywords: grinder\nTemplate: Guide\nIntent: Help choose\n\n'))
  assert.match(user, /# Company mentions/)
  assert.match(user, /\[hypothesis\]/)
  assert.doesNotMatch(user, /# Evidence bank|We tested six budget grinders|## How we sound/)
  assert.equal(buildBriefAnglePrompt(input).user, user)
})
test('an option tied to no pain and no gap is not grounded, so it is dropped', () => {
  assert.deepEqual(parseBriefAngles({angles: [{...option, pain: null, gaps: []}]}, allowed), [])
  assert.equal(parseBriefAngles({angles: [{...option, pain: null}]}, allowed).length, 1, 'a known gap alone grounds it')
  assert.equal(parseBriefAngles({angles: [{...option, gaps: []}]}, allowed).length, 1, 'a known pain alone grounds it')
})
