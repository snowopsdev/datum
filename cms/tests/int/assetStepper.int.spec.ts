import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * "Draft this step with the setup assistant" reads the workspace's own site
 * pages. With none fetched it drafts from almost nothing and the operator has
 * no way to know, so the box says so and links to the step that fetches them.
 */
vi.mock('@/components/ops/setupActions', () => ({ assistAction: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))

const { AssetStepper } = await import('@/components/ops/AssetStepper')

const steps = [
  { id: 'who', title: 'Who', blurb: 'Who this is for.', assist: 'who' },
  { id: 'review', title: 'Review', blurb: 'Check it over.' },
] as const

const stepper = (props: Record<string, unknown>) =>
  React.createElement(AssetStepper, {
    heading: 'Audience',
    lede: 'One reader.',
    steps,
    step: 0,
    onStep: vi.fn(),
    asset: 'icp' as const,
    sectionValue: () => ({}),
    onAssist: vi.fn(),
    disabled: false,
    actions: null,
    children: null,
    ...props,
  } as never)

afterEach(cleanup)

it('warns that the assistant has no site pages to read, and links to the Workspace step', () => {
  render(stepper({ sitePagesFetchedAt: null }))

  const hint = screen.getByText(
    /No site pages fetched yet — the assistant drafts from your site\./,
  )
  expect(hint.textContent).toContain('Fetch them on the Workspace step.')
  expect(screen.getByRole('link', { name: 'Workspace step' }).getAttribute('href')).toBe(
    '/admin/ops/setup/workspace',
  )
})

it('says nothing once pages are fetched, or on a step with no assistant', () => {
  render(stepper({ sitePagesFetchedAt: '2026-09-01T10:00:00.000Z' }))
  expect(screen.queryByText(/No site pages fetched yet/)).toBeNull()

  cleanup()
  render(stepper({ sitePagesFetchedAt: null, step: 1 }))
  expect(screen.queryByText(/No site pages fetched yet/)).toBeNull()
})
