import { describe, expect, it } from 'vitest'

import { describeViolation, qaFailures } from '@/components/ops/articleStatus'

describe('describeViolation', () => {
  it('states the limit and the actual value, not just the code', () => {
    const d = describeViolation({ code: 'TITLE_TAG_TOO_LONG', limit: 60, actual: 74, titleTag: 'x' })
    expect(d?.what).toBe('The SEO title tag is 74 characters; the limit is 60.')
    expect(d?.fix).toContain('60 characters or fewer')
    expect(d?.code).toBe('TITLE_TAG_TOO_LONG')
  })

  it('names which social tags are missing, in words', () => {
    const d = describeViolation({ code: 'OG_TAGS_MISSING', missing: ['ogTitle', 'ogImage'] })
    expect(d?.what).toContain('social title, social image')
    expect(d?.fix).toContain('social title and social image')
  })

  it('warns that a social image must be an image URL, only when one is missing', () => {
    const withImage = describeViolation({ code: 'OG_TAGS_MISSING', missing: ['ogImage'] })
    const without = describeViolation({ code: 'OG_TAGS_MISSING', missing: ['ogTitle'] })
    expect(withImage?.fix).toContain('direct URL to an image file')
    expect(without?.fix).not.toContain('direct URL to an image file')
  })

  it('renders the FAQ range from the template, open-ended when there is no max', () => {
    expect(
      describeViolation({ code: 'FAQ_COUNT_OUT_OF_RANGE', min: 3, max: 6, actual: 1 })?.what,
    ).toBe('The article has 1 FAQ question; the template asks for 3–6.')
    expect(
      describeViolation({ code: 'FAQ_COUNT_OUT_OF_RANGE', min: 3, max: null, actual: 0 })?.what,
    ).toContain('at least 3')
  })

  it('attributes a banned phrase to the brand voice or the platform guide', () => {
    const brand = describeViolation({
      code: 'BANNED_PHRASE',
      phrase: 'synergy',
      field: 'body',
      context: '',
      source: 'brand',
    })
    expect(brand?.what).toContain('your brand voice')
    const platform = describeViolation({
      code: 'BANNED_PHRASE',
      phrase: 'synergy',
      field: 'body',
      context: '',
      source: 'platform',
    })
    expect(platform?.what).toContain('the platform style guide')
  })

  it('gives a different instruction per heading problem', () => {
    const missing = describeViolation({
      code: 'HEADING_STRUCTURE',
      problem: 'missing_section',
      heading: 'What you need',
      detail: 'Required section missing',
    })
    expect(missing?.fix).toContain('"What you need"')
    const multiple = describeViolation({
      code: 'HEADING_STRUCTURE',
      problem: 'multiple_h1',
      heading: '',
      detail: 'Two H1s',
    })
    expect(multiple?.fix).toContain('exactly one H1')
  })

  it('falls back to a legacy free-text message rather than dropping it', () => {
    const d = describeViolation({ code: 'BANNED_PHRASE', message: 'found "game changer"' })
    expect(d?.what).toBe('found "game changer"')
    const unknown = describeViolation({ code: 'SOMETHING_NEW', message: 'a new rule broke' })
    expect(unknown?.what).toBe('a new rule broke')
  })

  it('keeps an unknown code visible instead of discarding the failure', () => {
    expect(describeViolation({ code: 'SOMETHING_NEW' })?.what).toBe('SOMETHING_NEW')
  })

  it('ignores values that are not violations', () => {
    expect(describeViolation(null)).toBeNull()
    expect(describeViolation({ nope: 1 })).toBeNull()
  })
})

describe('qaFailures', () => {
  it('returns nothing for an article with no QA results', () => {
    expect(qaFailures({})).toEqual([])
  })

  it('includes the model notes only for checks that actually failed', () => {
    const failures = qaFailures({
      qaResults: {
        structural: { passed: true, violations: [] },
        factCheck: { passed: true, notes: 'all good' },
        qualitativeReview: { passed: false, notes: 'too salesy' },
      },
    } as never)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('qualitativeReview')
    expect(failures[0].what).toBe('too salesy')
  })

  it('hands the fact checker\'s verified sources to the rewrite', () => {
    const [f] = qaFailures({
      qaResults: {
        factCheck: {
          passed: false,
          notes: 'Season count is wrong',
          sources: ['https://example.com/seasons', 'not a url', { url: 'https://other.org/x' }],
        },
      },
    } as never)
    expect(f.sources).toEqual(['https://example.com/seasons', 'https://other.org/x'])
    expect(f.fix).toContain('https://example.com/seasons')
    expect(f.fix).toContain('keep every other fact as it stands')
  })

  it('asks for a citation instead when the checker recorded no sources', () => {
    const [f] = qaFailures({
      qaResults: { factCheck: { passed: false, notes: 'wrong', sources: [] } },
    } as never)
    expect(f.sources).toEqual([])
    expect(f.fix).toContain('Cite a source')
  })

  it('carries every structural violation through, described', () => {
    const failures = qaFailures({
      qaResults: {
        structural: {
          passed: false,
          violations: [
            { code: 'READING_LEVEL_TOO_HIGH', limit: 11, actual: 14.2 },
            { code: 'OG_TAGS_MISSING', missing: ['ogImage'] },
          ],
        },
      },
    } as never)
    expect(failures).toHaveLength(2)
    expect(failures[0].what).toContain('grade 14.2')
    expect(failures.every((f) => f.check === 'structural')).toBe(true)
  })
})
