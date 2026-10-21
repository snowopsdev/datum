import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * The create buttons name the template the piece will be written as, so the
 * operator can see what they are about to make without reading the card above.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}))
vi.mock('@/components/ops/topicDiscoveryActions', () => ({
  createTopicsAction: vi.fn(),
  discoverTopicsAction: vi.fn(async (seed: string) => ({
    ok: true,
    seed,
    candidates: [
      {
        keyword: 'espresso machine',
        volume: 1200,
        difficulty: 12,
        opportunity: 100,
        alreadyTaken: false,
        archived: false,
      },
      {
        keyword: 'home espresso machine',
        volume: 800,
        difficulty: 10,
        opportunity: 90,
        alreadyTaken: false,
        archived: false,
      },
    ],
    cached: false,
    fetchedAt: new Date().toISOString(),
  })),
  recentSearchesAction: vi.fn(async () => []),
}))
vi.mock('@/components/ops/ContentRunForm', () => ({ ContentRunForm: () => null }))

const { NewContentFlow } = await import('@/components/ops/NewContentFlow')
const { TopicDiscovery } = await import('@/components/ops/TopicDiscovery')

const templates = [
  { id: 1, name: 'Listicle', intent: null, requiredSections: 2 },
  { id: 2, name: 'How-To', intent: null, requiredSections: 3 },
]

afterEach(cleanup)

it('names the chosen template on the keyword create button', () => {
  render(
    React.createElement(NewContentFlow, {
      templates,
      mode: 'mock',
      pipelineReady: true,
      runActive: false,
      blockers: [],
    }),
  )

  fireEvent.click(screen.getAllByRole('radio')[1])
  fireEvent.click(screen.getByRole('tab', { name: 'I know the keyword' }))

  expect(screen.getByRole('button', { name: 'Create How-To' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create how-to' })).toBeNull()
})

it('names the template its topics will be written as on the suggest create button', async () => {
  render(
    React.createElement(TopicDiscovery, {
      templates,
      mode: 'mock',
      templateId: 2,
      pipelineReady: true,
    }),
  )

  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'espresso' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Find topics' }))
  })
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select espresso machine' }))

  expect(screen.getByRole('button', { name: 'Create How-To' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create piece' })).toBeNull()
})

it.each([
  { templateId: 2, label: 'How-To' },
  { templateId: 999, label: 'piece' },
])('names $label when combining several searches into one piece', async ({ templateId, label }) => {
  render(
    React.createElement(TopicDiscovery, {
      templates,
      mode: 'mock',
      templateId,
      pipelineReady: true,
    }),
  )

  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'espresso' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Find topics' }))
  })
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select espresso machine' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select home espresso machine' }))

  expect(
    screen.getByRole('button', { name: `Create 1 ${label} covering 2 searches` }),
  ).toBeTruthy()

  fireEvent.click(screen.getByRole('checkbox', { name: 'Select home espresso machine' }))
  expect(screen.getByRole('button', { name: `Create ${label}` })).toBeTruthy()
})
