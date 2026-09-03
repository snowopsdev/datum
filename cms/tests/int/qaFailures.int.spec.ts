import { describe, expect, it } from 'vitest'

import {
  describeViolation,
  evidenceCitationsOf,
  evidenceFindingsOf,
  QA_CHECK_LABEL,
  qaFailureLines,
  qaFailures,
} from '@/components/ops/articleStatus'

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

/**
 * A failing evidence check has to survive the round trip into the article and
 * back out as instructions the next draft can act on.
 *
 * The pipeline never writes `revisionNotes` — that field belongs to the
 * reviewer's regenerate action, which builds it from `qaFailures` — so the
 * failing excerpts travel inside `qaResults.evidenceCheck.notes` and are picked
 * up here. Without this the article goes back to `needs_revision` with nothing
 * telling the writer which sentence to cut.
 */
describe('the evidence check as a QA failure', () => {
  const failing = {
    qaResults: {
      structural: { passed: true, violations: [] },
      factCheck: { passed: true, notes: 'all good' },
      qualitativeReview: { passed: true, notes: 'fine' },
      evidenceCheck: {
        passed: false,
        notes:
          'One rejected claim.\n\nRemove or replace: Datum guarantees your articles will rank. (rejected, use E1)',
        claims: [
          {
            excerpt: 'Datum guarantees your articles will rank.',
            kind: 'first_party',
            status: 'rejected',
            ref: 'R6',
            note: 'Paraphrases a rejected claim.',
          },
        ],
      },
    },
  }

  it('sends the failing excerpts to the rewrite, with a fix that forbids hedging', () => {
    const failures = qaFailures(failing as never)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('evidenceCheck')
    expect(failures[0].what).toContain(
      'Remove or replace: Datum guarantees your articles will rank. (rejected, use E1)',
    )
    // A softened version of an unsupported claim is still unsupported, and the
    // instruction has to say so or the next draft simply hedges it.
    expect(failures[0].fix).toContain('a hedged version of it is still unsupported')
  })

  it('labels the check for the regeneration prompt', () => {
    expect(QA_CHECK_LABEL.evidenceCheck).toBe('Evidence')
    expect(qaFailureLines(failing as never).some((line) => line.startsWith('Evidence: '))).toBe(true)
  })

  it('adds nothing when the check passed', () => {
    expect(
      qaFailures({
        qaResults: {
          ...failing.qaResults,
          evidenceCheck: { passed: true, notes: 'No first-party claims found.', claims: [] },
        },
      } as never),
    ).toEqual([])
  })
})

/**
 * `qaResults.evidenceCheck.claims` is a JSON column written by a model-shaped
 * pipeline, so the review view trusts nothing about its shape.
 */
describe('evidenceFindingsOf', () => {
  it('keeps well-formed findings and drops the rest', () => {
    expect(
      evidenceFindingsOf([
        { excerpt: 'Backed.', kind: 'first_party', status: 'backed', ref: 'E1', note: 'ok' },
        { excerpt: 'Deterministic.', status: 'unusable', ref: 'E9', note: 'no such entry' },
        { excerpt: '', status: 'rejected' },
        { excerpt: 'Unknown status.', status: 'probably_fine' },
        null,
        'not an object',
      ]),
    ).toEqual([
      { excerpt: 'Backed.', kind: 'first_party', status: 'backed', ref: 'E1', note: 'ok' },
      {
        excerpt: 'Deterministic.',
        kind: 'first_party',
        status: 'unusable',
        ref: 'E9',
        note: 'no such entry',
      },
    ])
  })

  it('reads a missing or malformed column as no findings', () => {
    for (const value of [null, undefined, 'text', 42, {}]) {
      expect(evidenceFindingsOf(value)).toEqual([])
    }
  })
})

describe('evidenceCitationsOf', () => {
  it('keeps rows that name an entry and drops the rest', () => {
    expect(
      evidenceCitationsOf([
        { ref: 'E1', excerpt: 'A reviewer approves the brief.' },
        { ref: 'F2' },
        { excerpt: 'no ref' },
        { ref: '', excerpt: 'blank ref' },
        null,
      ]),
    ).toEqual([
      { ref: 'E1', excerpt: 'A reviewer approves the brief.' },
      { ref: 'F2', excerpt: '' },
    ])
    expect(evidenceCitationsOf(null)).toEqual([])
  })
})
