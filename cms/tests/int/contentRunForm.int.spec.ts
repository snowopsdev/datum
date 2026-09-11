import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * The gap form sits inside the New content screen, under a card the operator
 * has already chosen. Asking the same question twice invites two answers, so
 * when the caller names a template the form states it instead of offering it.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/ops/contentRunActions', () => ({ startContentRunAction: vi.fn() }))

const { ContentRunForm } = await import('@/components/ops/ContentRunForm')

const templates = [
  { id: 1, name: 'Listicle' },
  { id: 2, name: 'How-To' },
]

afterEach(cleanup)

it('offers the template picker when the caller has not chosen one', () => {
  render(
    React.createElement(ContentRunForm, {
      templates,
      mode: 'mock' as const,
      pipelineReady: true,
      runActive: false,
    }),
  )

  expect(screen.getByLabelText('Content template')).toBeTruthy()
})

it('states the chosen template instead of asking again', () => {
  render(
    React.createElement(ContentRunForm, {
      templates,
      mode: 'mock' as const,
      pipelineReady: true,
      runActive: false,
      selectedTemplateId: 2,
    }),
  )

  expect(screen.queryByLabelText('Content template')).toBeNull()
  expect(screen.getByText('How-To')).toBeTruthy()
})
