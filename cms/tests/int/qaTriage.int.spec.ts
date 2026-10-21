import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import { qaFailures } from '@/components/ops/articleStatus'
import { QaTriage } from '@/components/ops/review/QaTriage'
import { summarizeReportArticles } from '@/lib/articleReportSummary'

/**
 * A check with no `passed` value never ran. It has to read as "Not run", not
 * FAIL, and every summary that counts failures has to leave it out.
 */
afterEach(cleanup)

const withQa = (qaResults: unknown) => ({ id: 1, qaResults }) as never

const markFor = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('.datum-ops__mark')

it('shows a check that did not run as Not run, distinct from pass and fail', () => {
  render(
    React.createElement(QaTriage, {
      article: withQa({
        structural: { passed: true, violations: [] },
        factCheck: { passed: false, notes: 'The launch date is wrong.' },
        qualitativeReview: { passed: null },
      }),
    }),
  )

  expect(markFor('Structural')?.textContent).toBe('PASS')
  expect(markFor('Fact check')?.textContent).toBe('FAIL')
  const notRun = markFor('Qualitative')
  expect(notRun?.textContent).toBe('Not run')
  expect(notRun?.classList.contains('datum-ops__mark--na')).toBe(true)
  expect(notRun?.classList.contains('datum-ops__mark--fail')).toBe(false)
})

it('marks every check Not run when the article has no QA results yet', () => {
  render(React.createElement(QaTriage, { article: withQa(null) }))

  expect(screen.getAllByText('Not run')).toHaveLength(4)
  expect(screen.queryByText('FAIL')).toBeNull()
})

it('leaves checks that did not run out of the failures and the pass rates', () => {
  const article = {
    id: 2,
    title: 'Draft',
    keyword: 'espresso',
    status: 'needs_revision',
    templateName: null,
    totalCostUsd: 0,
    informationGain: null,
    qaResults: {
      structural: { passed: null, violations: null },
      factCheck: { passed: null, notes: null },
      qualitativeReview: { passed: false, notes: 'The tone slips into hype.' },
    },
  } as never

  expect(qaFailures(article).map((f) => f.check)).toEqual(['qualitativeReview'])

  const summary = summarizeReportArticles([article])
  expect(summary.failures[0].fails).toEqual(['qualitative'])
  expect(summary.withQaCount).toBe(0)
  expect(summary.st).toEqual({ t: 0, p: 0 })
  expect(summary.fc).toEqual({ t: 0, p: 0 })
  expect(summary.qu).toEqual({ t: 1, p: 0 })
})
