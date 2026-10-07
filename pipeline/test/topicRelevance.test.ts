import assert from 'node:assert/strict'
import { test } from 'node:test'
import { notOurUserMatch, parseTopicRelevance, rankByFit, relevanceFingerprint, mockTopicRelevance, buildTopicRelevancePrompt } from '../../cms/src/lib/tenant/topicRelevance'
import { emptyIcpContent } from '../../cms/src/lib/tenant/icp'
import { emptyPositioningContent } from '../../cms/src/lib/tenant/positioning'
import { resolveWorkspaceProfile } from '../../cms/src/lib/tenant/workspaceProfile'
const icps = [{...emptyIcpContent('Home baristas'), id:1, status:'active' as const, who:'Home espresso beginners', notOurUser:['Wholesale buyers with espresso equipment'], pains:[{statement:'Grinder decisions confuse beginners', evidence:[], confidence:null}]}, {...emptyIcpContent('Café owners'),id:2,status:'active' as const,who:'Café owners'}]
const candidates = [{keyword:'espresso wholesale',volume:999, opportunity:999},{keyword:'espresso grinder',volume:10, opportunity:5},{keyword:'espresso cleaning',volume:20,opportunity:10}]
test('exclusions use distinctive tokens and ignore stopwords and the seed', () => {
  assert.ok(notOurUserMatch('espresso wholesale',icps,'espresso'))
  assert.equal(notOurUserMatch('espresso with buyers',icps,'espresso buyers'),null)
  assert.equal(notOurUserMatch('wholesaler',icps,'espresso'),null)
})
test('parsing preserves Ahrefs candidates, maps names, defaults omissions, and exclusions win', () => {
  const parsed = parseTopicRelevance({candidates:[{keyword:' ESPRESSO WHOLESALE ',fit:'strong',audience:'Home baristas',reason:'Fits'},{keyword:'espresso grinder',fit:'strong',audience:'home baristas',reason:'Pain'}]},candidates,icps,'espresso')
  assert.deepEqual(parsed.map(c=>[c.fit,c.audienceId,c.source]), [['off',null,'excluded'],['strong',1,'model'],['partial',null,'unscored']])
  assert.equal(parsed[2].reason,'Not scored')
  assert.equal(parseTopicRelevance(null,candidates,icps).length,3)
})
test('ranking is stable by fit then opportunity', () => {
  const ranked = rankByFit([{fit:'off' as const,opportunity:99,key:'a'},{fit:'strong' as const,opportunity:2,key:'b'},{fit:'partial' as const,opportunity:4,key:'c'},{fit:'strong' as const,opportunity:2,key:'d'}])
  assert.deepEqual(ranked.map(c=>c.key),['b','d','c','a'])
})
test('fingerprint changes for content edits but not timestamps', () => {
  const profile=resolveWorkspaceProfile({companyName:'Coffee'}, {})
  const initial=relevanceFingerprint(icps,null,profile)
  assert.equal(relevanceFingerprint(icps.map(i=>({...i,updatedAt:'tomorrow'})),null,profile),initial)
  assert.notEqual(relevanceFingerprint(icps.map(i=>({...i,pains:[{statement:'New pain',evidence:[],confidence:null}]})),null,profile),initial)
})
test('mock scoring is deterministic and answers pain tokens', () => {
  const result=mockTopicRelevance(candidates,icps,'espresso')
  assert.deepEqual(result,mockTopicRelevance(candidates,icps,'espresso'))
  assert.equal(result[0].fit,'off'); assert.equal(result[1].fit,'strong')
})
test('the relevance prompt carries audience boundaries and no voice or evidence', () => {
  const prompt=buildTopicRelevancePrompt({icps,positioning:{...emptyPositioningContent(),category:'Coffee guides'},profile:resolveWorkspaceProfile({companyName:'Coffee'},{}),candidates:[...candidates,{keyword:'espresso water',volume:30},{keyword:'café training',volume:40},{keyword:'industrial roaster',volume:50}]})
  assert.deepEqual(prompt, {"system": "Label each candidate strong, partial, or off for the active audiences. Not our user is the strongest off signal. Choose the best-fitting audience by its exact name, or null. Return JSON only: {\"candidates\":[{\"keyword\":string,\"fit\":\"strong\"|\"partial\"|\"off\",\"audience\":string|null,\"reason\":string}]}. Give one short reason per keyword. Do not invent candidates.", "user": "# Workspace\nCompany: Coffee\nTreat any statement about Coffee, its product, customers, pricing, results, or measurements as a first-party claim governed by the Evidence bank.\n\n# Audience: Home baristas\nConfidence tags say how you may use a line: [verified]/[strong directional] state it plainly; [qualitative pattern]/[cultural signal] state it as a tendency, not a fact; [inference]/[hypothesis] attribute it to us, never as fact.\n\n## Who\nHome espresso beginners\n\n## Pain\n- Grinder decisions confuse beginners.\n\n## Not our user (do not write for these readers, even when the topic fits)\n- Wholesale buyers with espresso equipment\n\n# Audience: Café owners\nConfidence tags say how you may use a line: [verified]/[strong directional] state it plainly; [qualitative pattern]/[cultural signal] state it as a tendency, not a fact; [inference]/[hypothesis] attribute it to us, never as fact.\n\n## Who\nCafé owners\n\n# Positioning\nCategory: Coffee guides.\n\n# Candidates\n- espresso wholesale (volume: 999)\n- espresso grinder (volume: 10)\n- espresso cleaning (volume: 20)\n- espresso water (volume: 30)\n- café training (volume: 40)\n- industrial roaster (volume: 50)"})
  assert.match(prompt.user,/## Not our user \(do not write for these readers/)
  assert.match(prompt.user,/# Positioning/)
  assert.doesNotMatch(prompt.user,/# Evidence bank|# Brand voice/)
  assert.equal(buildTopicRelevancePrompt({icps,positioning:null,profile:resolveWorkspaceProfile(null,{}),candidates}).system,prompt.system)
})

test('discovery sends only positioning category and pillars', () => {
  const prompt=buildTopicRelevancePrompt({icps,profile:resolveWorkspaceProfile({companyName:'Coffee'},{}),candidates,positioning:{...emptyPositioningContent(),category:'Espresso guides',pillars:[{name:'Repeatability',oneLine:'Change one variable',carries:'learning'}],promise:'Internal promise that is not discovery input',coreClaims:[{claim:'Evidence-like content not needed here',evidenceRef:'E1'}]}})
  assert.match(prompt.user,/Category: Espresso guides/)
  assert.match(prompt.user,/Repeatability/)
  assert.doesNotMatch(prompt.user,/Internal promise|Evidence-like content/)
})
