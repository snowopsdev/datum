import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WORKSPACE_PROFILE_FIXTURE, ICP_FIXTURE, ICP_FIXTURE_SECONDARY, POSITIONING_FIXTURE, EVIDENCE_BANK_FIXTURE } from '../../cms/src/lib/tenant/fixtures'
import { BRAND_VOICE_FIXTURE } from '../../cms/src/lib/brandVoiceFixture'
import { isClaimComplete } from '../../cms/src/lib/tenant/evidenceBank'
import { mockPageText } from '../src/corpus/mockPages'
import { mockFixture } from '../src/fixtures'

test('the demo tells one home-espresso story and demonstrates evidence boundaries', () => {
  assert.equal(WORKSPACE_PROFILE_FIXTURE.companyName, 'Kettle & Burr')
  assert.equal(WORKSPACE_PROFILE_FIXTURE.targetDomain, 'kettleandburr.example.com')
  assert.match(ICP_FIXTURE.who, /home barista/i)
  assert.match(ICP_FIXTURE_SECONDARY.who, /café/i)
  assert.match(POSITIONING_FIXTURE.category, /espresso/i)
  assert.match(BRAND_VOICE_FIXTURE.essence.oneLiner, /Kettle & Burr/)
  assert.match(mockPageText('https://kettleandburr.example.com/').title, /Kettle & Burr/)
  assert.ok(EVIDENCE_BANK_FIXTURE.verifiedClaims.some(c => !isClaimComplete(c)))
  assert.ok(EVIDENCE_BANK_FIXTURE.verifiedClaims.some(c => c.clearedSurfaces.join() === 'sales'))
  assert.ok(ICP_FIXTURE.notOurUser.length && ICP_FIXTURE.churnTriggers.length)
  assert.ok(ICP_FIXTURE_SECONDARY.notOurUser.length && ICP_FIXTURE_SECONDARY.churnTriggers.length)
  assert.deepEqual((mockFixture('evidenceCheck') as {claims: {status: string; ref: string}[]}).claims.map(c => [c.status, c.ref]), [['backed', 'E1']])
})
