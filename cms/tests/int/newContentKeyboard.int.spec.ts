import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),
}))
vi.mock('@/components/ops/topicDiscoveryActions', () => ({ createTopicsAction: vi.fn() }))
vi.mock('@/components/ops/TopicDiscovery', () => ({ TopicDiscovery: () => null }))
vi.mock('@/components/ops/ContentRunForm', () => ({ ContentRunForm: () => null }))
const { NewContentFlow } = await import('@/components/ops/NewContentFlow')
afterEach(cleanup)

it('offers one template tab stop and selects adjacent templates with arrow keys', () => {
  render(React.createElement(NewContentFlow, {
    templates: [
      { id: 1, name: 'Listicle', intent: null, requiredSections: 2 },
      { id: 2, name: 'How-To', intent: null, requiredSections: 3 },
      { id: 3, name: 'Comparison', intent: null, requiredSections: 4 },
    ], mode: 'mock', pipelineReady: true, runActive: false,
  }))
  const radios = screen.getAllByRole('radio')
  expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1])
  radios[0].focus()
  fireEvent.keyDown(radios[0], { key: 'ArrowRight' })
  expect(document.activeElement).toBe(radios[1])
  expect(radios[1].getAttribute('aria-checked')).toBe('true')
  expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1])
  fireEvent.keyDown(radios[1], { key: 'ArrowDown' })
  expect(document.activeElement).toBe(radios[2])
  fireEvent.keyDown(radios[2], { key: 'ArrowRight' })
  expect(document.activeElement).toBe(radios[0])
  fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })
  expect(document.activeElement).toBe(radios[2])
  fireEvent.keyDown(radios[2], { key: 'Home' })
  expect(document.activeElement).toBe(radios[0])
  fireEvent.keyDown(radios[0], { key: 'End' })
  expect(document.activeElement).toBe(radios[2])
  expect(radios[2].getAttribute('aria-checked')).toBe('true')
})
