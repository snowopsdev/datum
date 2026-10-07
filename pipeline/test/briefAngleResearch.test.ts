import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stages } from '../src/stages'
const researchStage = stages[0]
import { createLlmClient } from '../src/llm'
import { createAhrefsClient } from '../src/ahrefs'
import { emptyTenantContext } from '../src/tenant'
import { ICP_FIXTURE } from '../../cms/src/lib/tenant/fixtures'
import { mockFixture } from '../src/fixtures'
import { PIPELINE_STAGES } from '../../cms/src/lib/llmSettings'
import type { StageContext } from '../src/stages'
import type { Article } from '../../cms/src/payload-types'
import { parseBriefAngles } from '../src/briefAngle'

const gaps = (mockFixture('claimExtraction', 'facets') as {gaps: unknown[]}).gaps
const article = {id:1, keyword:'espresso grinder', status:'topic_selected', template:{name:'Listicle',intent:'Rank options',requiredSections:[]}} as unknown as Article
const context = (): StageContext => ({
  payload: {find: async () => ({docs: [{id:1, status: 'complete', capturedAt: new Date().toISOString(), facets:[], gaps, baselineDocCount:3}]}), create: async () => ({id:1})},
  tenant: {...emptyTenantContext(), icps: [{...ICP_FIXTURE,id:1}]}, brandVoice:null,
  ahrefs:createAhrefsClient('mock'), llm:createLlmClient('mock'), runId:'angles-test', mode:'mock',
  models:Object.fromEntries(PIPELINE_STAGES.map(s => [s, 'mock'])),
} as unknown as StageContext)
test('mock research stores three grounded options plus fallback and stops for approval', async () => {
  const result = await researchStage.run(article, context())
  const brief = result.data.brief!
  assert.equal(result.status, 'brief_review')
  assert.ok(Array.isArray(brief.angleOptions))
  assert.equal(brief.angleOptions.length, 4)
  assert.equal(brief.angle, (brief.angleOptions[0] as {angle: string}).angle)
  assert.equal((brief.angleOptions[3] as {rationale:string}).rationale, 'From the template')
})
test('a thrown angle call keeps the template direction with one warning', async () => {
  const ctx = context(); ctx.llm = {completeJSON: async () => {throw new Error('Unavailable')}}
  const result = await researchStage.run(article, ctx)
  assert.equal(result.status, 'brief_review')
  assert.equal(result.data.brief?.angle, 'Rank options for "espresso grinder"')
  assert.deepEqual(result.warnings, ['brief angle: Unavailable'])
})
test('the angle fixture references only demo pains and snapshot gaps', () => {
  assert.equal(parseBriefAngles(mockFixture('briefAngle'), {pains:ICP_FIXTURE.pains.map(p=>p.statement),gapLabels:(gaps as {label:string}[]).map(g=>g.label)}).length, 3)
})
test('a saved editor brief is outside the research entry status', () => {
  assert.equal(researchStage.entryStatus, 'topic_selected')
  assert.notEqual(researchStage.entryStatus, 'brief_review')
  assert.notEqual(researchStage.entryStatus, 'researched')
})

test('a cost-log write that fails after a paid angle call stops research instead of becoming a warning', async () => {
  const ctx = context()
  const create = ctx.payload.create
  ctx.payload.create = (async (args: { collection: string }) => {
    if (args.collection === 'cost-log') throw new Error('relation "cost_log" does not exist')
    return create(args as never)
  }) as typeof ctx.payload.create
  await assert.rejects(researchStage.run(article, ctx), /cost-log write failed for briefAngle: relation "cost_log" does not exist/)
})
