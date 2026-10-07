import assert from 'node:assert/strict'
import {test} from 'node:test'
import {removedPhrases,recurringNotTraits,recurringUnbackedClaims,recurringRejectedRefs} from '../../cms/src/lib/setupSuggestions/signals'
const article=(id:number,publishedText='Plain advice.')=>({articleId:id,keyword:'espresso',generatedText:'Synergy. Crystal clear advice costs 40 dollars. Espresso advice.',publishedText,at:'2026-10-01'})
test('a phrase removed in three articles is suggested, but a kept phrase is not',()=>{
  const rows=[article(1),article(2),article(3)]
  // The longest removed wording, not every fragment of it.
  assert.deepEqual(removedPhrases(rows).map(c=>c.proposal.phrase).sort(),['crystal clear advice costs','dollars','synergy'])
  assert.ok(!removedPhrases([...rows,article(4,'Crystal clear advice.')]).some(c=>c.proposal.phrase==='crystal clear'))
})
test('stopwords, keyword tokens, numbers and already banned phrases cannot become suggestions',()=>{
  const rows=[article(1),article(2),article(3)]
  const result=removedPhrases(rows,['synergy','crystal clear'])
  assert.ok(!result.some(c=>/synergy|crystal clear|espresso|40/.test(String(c.proposal.phrase))))
  assert.ok(!removedPhrases(rows.map(r=>({...r,generatedText:'Beautiful. Useful.'}))).some(c=>c.proposal.phrase==='beautiful useful'))
})
const qa=(articleId:number,over:Record<string,unknown>={})=>({articleId,at:'2026-10-01',...over})
test('not-trait findings count articles rather than QA passes',()=>{
  const finding={qualitativeReview:{notTraitViolations:[{trait:'Sarcastic',excerpt:'Nice job, genius.'}]}}
  assert.equal(recurringNotTraits([qa(1,finding),qa(1,finding),qa(2,finding)]).length,0)
  assert.equal(recurringNotTraits([qa(1,finding),qa(1,finding),qa(2,finding),qa(3,finding)])[0].occurrences.length,3)
})
test('near-identical unbacked claims merge, but different numbers never merge',()=>{
  const claim=(excerpt:string)=>({evidenceCheck:{claims:[{kind:'first_party',status:'unbacked',excerpt}]}})
  assert.equal(recurringUnbackedClaims([qa(1,claim('We save readers 40 percent of beans.')),qa(2,claim('Our readers save 40 percent of their beans.'))]).length,1)
  assert.equal(recurringUnbackedClaims([qa(1,claim('We save readers 40 percent of beans.')),qa(2,claim('We save readers 60 percent of beans.'))]).length,0)
})
test('rejected references group across distinct articles, ignoring public claims',()=>{
  const finding={evidenceCheck:{claims:[{status:'rejected',ref:'r6',excerpt:'Perfect shots.'}]}}
  assert.equal(recurringRejectedRefs([qa(1,finding),qa(1,finding),qa(2,finding)]).length,0)
  assert.equal(recurringRejectedRefs([qa(1,finding),qa(2,finding),qa(3,finding)])[0].proposal.ref,'R6')
  assert.equal(recurringUnbackedClaims([qa(1,{evidenceCheck:{claims:[{kind:'public',status:'unbacked',excerpt:'World is round'}]}})]).length,0)
})

test('one removed phrase becomes one suggestion, never a suggestion per fragment',()=>{
  const rows=[1,2,3].map(id=>({articleId:id,keyword:'grinder',generatedText:'The crema looks like warm honey when it is right.',publishedText:'The crema is right when it pours evenly.',at:'2026-10-01'}))
  // Without collapsing, "like", "looks", "warm" and "honey" each become a banned-word suggestion.
  assert.deepEqual(removedPhrases(rows).map(c=>c.proposal.phrase),['looks like warm honey'])
})
test('a fragment removed in more articles than its longer phrase stays its own suggestion',()=>{
  const honey=(id:number)=>({articleId:id,keyword:'grinder',generatedText:'It looks like warm honey.',publishedText:'It pours.',at:'2026-10-01'})
  const plain=(id:number)=>({articleId:id,keyword:'grinder',generatedText:'Warm honey tones.',publishedText:'Tones.',at:'2026-10-01'})
  const phrases=removedPhrases([honey(1),honey(2),honey(3),plain(4)]).map(c=>c.proposal.phrase)
  assert.ok(phrases.includes('looks like warm honey'))
  assert.ok(phrases.includes('warm honey'), 'removed in four articles, so it is not covered by the three-article phrase')
})
