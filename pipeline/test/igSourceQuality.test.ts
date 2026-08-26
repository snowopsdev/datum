import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  hostnameOf,
  normaliseDomain,
  resolveSourceQuality,
  SOURCE_QUALITY_SCORE,
  UNKNOWN_DOMAIN_CAP,
  type EvidenceSourceRule,
} from '../src/informationGain/lib'

const rule = (overrides: Partial<EvidenceSourceRule> = {}): EvidenceSourceRule => ({
  domain: 'example.com',
  qualityClass: 'primary',
  active: true,
  ...overrides,
})

describe('normaliseDomain', () => {
  it('strips scheme, credentials, port, path, query, and a leading www.', () => {
    assert.equal(normaliseDomain('https://www.Example.com:8443/docs/a?b=1#c'), 'example.com')
    assert.equal(normaliseDomain('  HTTP://user:pass@Docs.Example.com/x  '), 'docs.example.com')
    assert.equal(normaliseDomain('//example.com/x'), 'example.com')
    assert.equal(normaliseDomain('example.com.'), 'example.com')
  })

  it('leaves a bare hostname alone', () => {
    assert.equal(normaliseDomain('docs.example.com'), 'docs.example.com')
  })

  it('returns an empty string when nothing is left', () => {
    assert.equal(normaliseDomain(''), '')
    assert.equal(normaliseDomain('   '), '')
    assert.equal(normaliseDomain('https:///path'), '')
  })
})

describe('hostnameOf', () => {
  it('returns the lower-cased hostname without www.', () => {
    assert.equal(hostnameOf('https://WWW.Example.com/docs?x=1'), 'example.com')
    assert.equal(hostnameOf('https://docs.example.com'), 'docs.example.com')
  })

  it('returns null for something that is not a URL', () => {
    assert.equal(hostnameOf('not a url'), null)
    assert.equal(hostnameOf(''), null)
  })
})

describe('resolveSourceQuality — evidence-source rules', () => {
  it('matches a rule on label boundaries, including subdomains', () => {
    const result = resolveSourceQuality('https://docs.example.com/a', [rule()], 'unknown')
    assert.deepEqual(result, {
      score: SOURCE_QUALITY_SCORE.primary,
      source: 'evidence-sources',
      matchedRule: 'example.com',
    })
  })

  it('does not match a domain that merely ends with the rule text', () => {
    const result = resolveSourceQuality('https://notexample.com/a', [rule()], 'secondary')
    assert.equal(result.source, 'rubric')
    assert.equal(result.matchedRule, null)
  })

  it('lets the longest matching rule win', () => {
    const rules = [
      rule({ domain: 'example.com', qualityClass: 'secondary' }),
      rule({ domain: 'docs.example.com', qualityClass: 'official_docs' }),
    ]
    const result = resolveSourceQuality('https://docs.example.com/a', rules, 'unknown')
    assert.deepEqual(result, {
      score: SOURCE_QUALITY_SCORE.official_docs,
      source: 'evidence-sources',
      matchedRule: 'docs.example.com',
    })
  })

  it('ignores inactive rules', () => {
    const rules = [rule({ qualityClass: 'first_party_dataset', active: false })]
    const result = resolveSourceQuality('https://example.com/a', rules, 'secondary')
    assert.deepEqual(result, {
      score: SOURCE_QUALITY_SCORE.secondary,
      source: 'rubric',
      matchedRule: null,
    })
  })

  it('scores a blocked rule at 0', () => {
    const rules = [rule({ qualityClass: 'blocked' })]
    assert.deepEqual(resolveSourceQuality('https://example.com/a', rules, 'primary'), {
      score: 0,
      source: 'evidence-sources',
      matchedRule: 'example.com',
    })
  })
})

describe('resolveSourceQuality — rubric fallback', () => {
  it('caps an unlisted domain at the unknown-domain cap', () => {
    assert.equal(UNKNOWN_DOMAIN_CAP, 0.75)
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'primary'), {
      score: 0.75,
      source: 'rubric_capped',
      matchedRule: null,
    })
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'official_docs'), {
      score: 0.75,
      source: 'rubric_capped',
      matchedRule: null,
    })
  })

  it('does not mark a rubric score capped when the cap did not bite', () => {
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'secondary'), {
      score: 0.75,
      source: 'rubric',
      matchedRule: null,
    })
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'unverified'), {
      score: 0.4,
      source: 'rubric',
      matchedRule: null,
    })
  })

  it('never grants first-party status from the rubric alone', () => {
    // A model cannot certify a domain as our own first-party dataset; only the
    // evidence-sources table can.
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'first_party_dataset'), {
      score: SOURCE_QUALITY_SCORE.unverified,
      source: 'rubric',
      matchedRule: null,
    })
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [], 'unknown'), {
      score: SOURCE_QUALITY_SCORE.unverified,
      source: 'rubric',
      matchedRule: null,
    })
  })

  it('scores an out-of-enum quality class at 0 rather than NaN', () => {
    // The collection's select prevents this, but a hand-written or imported row
    // could carry one; undefined here would become NaN evidence integrity,
    // which compares false against every floor and would silently pass.
    const bogus = rule({ qualityClass: 'made_up' as EvidenceSourceRule['qualityClass'] })
    assert.deepEqual(resolveSourceQuality('https://example.com/a', [bogus], 'primary'), {
      score: 0,
      source: 'evidence-sources',
      matchedRule: 'example.com',
    })
  })

  it('scores an unparseable URL at 0', () => {
    assert.deepEqual(resolveSourceQuality('not a url', [rule()], 'primary'), {
      score: 0,
      source: 'rubric',
      matchedRule: null,
    })
  })
})
