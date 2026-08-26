import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DRAFT_CLAIM_EXTRACTION_SYSTEM,
  JUDGE_SYSTEM,
  VERIFIER_SYSTEM,
  draftClaimUser,
  judgeUser,
  verifierUser,
} from '../src/informationGain/prompts'
import {
  CLAIM_TYPES,
  DEFAULT_MAX_DRAFT_CLAIMS,
  SOURCE_QUALITY_CLASSES,
  type BaselineClaim,
  type DraftClaim,
  type Facet,
} from '../src/informationGain/lib'

const facet: Facet = {
  id: 'f1',
  label: 'Budget and cost',
  description: 'What a first setup costs.',
  weight: 1,
  docCount: 3,
  mustHave: true,
  matchesHint: null,
  claimIds: ['b1-1'],
}

const claim: DraftClaim = {
  id: 'c001',
  text: 'A first setup costs $500 to $1,500.',
  type: 'factual',
  excerpt: 'a budget of $500 to $1,500',
  section: 'Introduction',
  facetId: 'f1',
  entities: ['setup'],
  values: ['$500', '$1,500'],
  restatesClaimId: null,
  excerptFound: true,
}

const baselineClaim: BaselineClaim = {
  id: 'b1-1',
  text: 'Beginners spend $500 to $1,500.',
  type: 'factual',
  excerpt: 'Beginners spend $500 to $1,500.',
  entities: [],
  values: ['$500'],
  source: { kind: 'serp', docId: 'serp:1', url: 'https://example.com/a' },
  facetId: 'f1',
}

describe('DRAFT_CLAIM_EXTRACTION_SYSTEM', () => {
  it('names every field parseDraftClaims reads, and every claim type it accepts', () => {
    for (const field of [
      'text',
      'type',
      'excerpt',
      'section',
      'facetId',
      'entities',
      'values',
      'restatesClaimIndex',
    ]) {
      assert.match(DRAFT_CLAIM_EXTRACTION_SYSTEM, new RegExp(`"${field}"`), field)
    }
    for (const claimType of CLAIM_TYPES) {
      assert.match(DRAFT_CLAIM_EXTRACTION_SYSTEM, new RegExp(`"${claimType}"`), claimType)
    }
  })

  it('asks for no more claims than the parser will keep', () => {
    assert.match(DRAFT_CLAIM_EXTRACTION_SYSTEM, new RegExp(`at most ${DEFAULT_MAX_DRAFT_CLAIMS}`))
  })

  it('requires a verbatim excerpt and forbids a forward restatement pointer', () => {
    assert.match(DRAFT_CLAIM_EXTRACTION_SYSTEM, /verbatim/)
    assert.match(DRAFT_CLAIM_EXTRACTION_SYSTEM, /never point at itself or at a later claim/)
  })
})

describe('JUDGE_SYSTEM', () => {
  it('names every field parseJudgeReply reads', () => {
    for (const field of [
      'claimId',
      'duplicateProbability',
      'closestBaselineClaimId',
      'internalDuplicateProbability',
      'closestInternalClaimId',
      'relevanceByQuery',
      'utility',
      'specificity',
      'actionability',
      'explanatoryPower',
      'audienceFit',
      'importance',
      'containsNumericOrTemporalClaim',
      'rationale',
    ]) {
      assert.match(JUDGE_SYSTEM, new RegExp(`"${field}"`), field)
    }
  })

  it('tells the judge not to verify, and that its numbers are uncalibrated', () => {
    assert.match(JUDGE_SYSTEM, /you never verify/)
    assert.match(JUDGE_SYSTEM, /uncalibrated/)
  })
})

describe('VERIFIER_SYSTEM', () => {
  it('names every field parseVerifierReply reads', () => {
    for (const field of [
      'claimId',
      'support',
      'contradiction',
      'evidence',
      'url',
      'excerpt',
      'publisher',
      'sourceKind',
      'notes',
    ]) {
      assert.match(VERIFIER_SYSTEM, new RegExp(`"${field}"`), field)
    }
  })

  it('offers only the source classes the rubric may assign', () => {
    for (const sourceClass of SOURCE_QUALITY_CLASSES) {
      const offered = new RegExp(`"${sourceClass}"`).test(VERIFIER_SYSTEM)
      // `first_party_dataset` and `blocked` are the admin table's to assign, not
      // the model's, so the prompt must never put them on the menu.
      assert.equal(
        offered,
        sourceClass !== 'first_party_dataset' && sourceClass !== 'blocked',
        sourceClass,
      )
    }
  })

  it('refuses self-citation and unquotable evidence', () => {
    assert.match(VERIFIER_SYSTEM, /Never cite the draft under review/)
    assert.match(VERIFIER_SYSTEM, /Omit an evidence item entirely if you cannot quote it/)
  })
})

describe('user builders', () => {
  it('sends the draft its facets as JSON and the draft text last', () => {
    const user = draftClaimUser({ keyword: 'home espresso', title: 'Espresso' }, [facet], 'Body.')
    assert.match(user, /Query: "home espresso"/)
    assert.match(user, /"id": "f1"/)
    // The claim ids the reply must not invent are not sent; the facet ids are.
    assert.doesNotMatch(user, /claimIds/)
    assert.ok(user.trimEnd().endsWith('Body.'))
  })

  it('sends the judge labelled query, facet, claim, and baseline blocks', () => {
    const user = judgeUser(
      { keyword: 'home espresso' },
      [{ id: 'q0', text: 'home espresso', kind: 'keyword', weight: 1 }],
      [facet],
      [claim],
      [baselineClaim],
    )
    assert.match(user, /Query cluster:/)
    assert.match(user, /Facets:/)
    assert.match(user, /Draft claims:/)
    assert.match(user, /Baseline claims:/)
    assert.match(user, /"id": "c001"/)
    assert.match(user, /"id": "b1-1"/)
    assert.match(user, /"corpus": "serp"/)
    // Our own bookkeeping is not the judge's business.
    assert.doesNotMatch(user, /excerptFound/)
  })

  it('sends the verifier each claim with its values and draft excerpt', () => {
    const user = verifierUser({ keyword: 'home espresso' }, [claim])
    assert.match(user, /"id": "c001"/)
    assert.match(user, /"draftExcerpt"/)
    assert.match(user, /"\$1,500"/)
  })
})
