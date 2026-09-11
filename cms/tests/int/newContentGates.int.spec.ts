import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * The New content screen used to offer every button to a workspace that could
 * not run: the only sign was one line inside a collapsed "find gaps" panel.
 * Now the same notice the gap panel shows sits above the cards, names what is
 * missing, links to the step that fixes it, and the create buttons are off.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))
vi.mock('@/components/ops/topicDiscoveryActions', () => ({ createTopicsAction: vi.fn() }))
vi.mock('@/components/ops/TopicDiscovery', () => ({ TopicDiscovery: () => null }))

const runFormProps = vi.fn()
vi.mock('@/components/ops/ContentRunForm', () => ({
  ContentRunForm: (props: Record<string, unknown>) => {
    runFormProps(props)
    return null
  },
}))

const { NewContentFlow } = await import('@/components/ops/NewContentFlow')

const templates = [
  { id: 1, name: 'Listicle', intent: null, requiredSections: 2 },
  { id: 2, name: 'How-To', intent: null, requiredSections: 3 },
]

afterEach(() => {
  cleanup()
  runFormProps.mockReset()
})

it('names every setup blocker above the cards and refuses to create while one stands', () => {
  render(
    React.createElement(NewContentFlow, {
      templates,
      mode: 'mock' as const,
      pipelineReady: false,
      runActive: false,
      blockers: [
        { asset: 'voice' as const, message: 'Activate a brand voice' },
        { asset: 'audiences' as const, message: 'Add and activate at least one audience (ICP)' },
      ],
    }),
  )

  const voice = screen.getByRole('link', { name: 'Activate a brand voice' })
  expect(voice.getAttribute('href')).toBe('/admin/ops/governance/brand-voice')
  expect(
    screen
      .getByRole('link', { name: 'Add and activate at least one audience (ICP)' })
      .getAttribute('href'),
  ).toBe('/admin/ops/setup/audiences')

  fireEvent.click(screen.getAllByRole('radio')[0])
  fireEvent.click(screen.getByRole('tab', { name: 'I know the keyword' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'espresso descaling' } })
  expect((screen.getByRole('button', { name: /^Create/ }) as HTMLButtonElement).disabled).toBe(
    true,
  )
})

it('names the missing template too, so the notice is never a dead end', () => {
  render(
    React.createElement(NewContentFlow, {
      templates: [],
      mode: 'mock' as const,
      pipelineReady: false,
      runActive: false,
      blockers: [{ asset: 'templates' as const, message: 'Add a content template' }],
    }),
  )

  expect(
    screen.getByRole('link', { name: 'Add a content template' }).getAttribute('href'),
  ).toBe('/admin/ops/templates')
})

it('creates as usual, and hands the gap form the card already chosen, when setup is done', () => {
  render(
    React.createElement(NewContentFlow, {
      templates,
      mode: 'mock' as const,
      pipelineReady: true,
      runActive: false,
      blockers: [],
    }),
  )

  expect(screen.queryByText(/Finish workspace setup/)).toBeNull()

  fireEvent.click(screen.getAllByRole('radio')[1])
  fireEvent.click(screen.getByRole('tab', { name: 'I know the keyword' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'espresso descaling' } })
  expect((screen.getByRole('button', { name: /^Create/ }) as HTMLButtonElement).disabled).toBe(
    false,
  )

  expect(runFormProps).toHaveBeenLastCalledWith(
    expect.objectContaining({ selectedTemplateId: 2 }),
  )
})
