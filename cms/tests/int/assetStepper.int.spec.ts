import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

/**
 * "Draft this step with the setup assistant" reads the workspace's own site
 * pages. With none fetched it drafts from almost nothing and the operator has
 * no way to know, so the box says so and links to the step that fetches them.
 */
vi.mock('@/components/ops/setupActions', () => ({ assistAction: vi.fn() }))
vi.mock('@/components/ops/tenantActions', () => ({ saveEvidenceBankAction: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))

const { AssetStepper } = await import('@/components/ops/AssetStepper')

const steps = [
  { id: 'who', title: 'Who', blurb: 'Who this is for.', assist: 'who' },
  { id: 'review', title: 'Review', blurb: 'Check it over.' },
] as const

const stepper = (assist: Record<string, unknown> | null, props: Record<string, unknown> = {}) =>
  React.createElement(AssetStepper, {
    heading: 'Audience',
    lede: 'One reader.',
    steps,
    step: 0,
    onStep: vi.fn(),
    ...(assist
      ? {
          assist: {
            asset: 'icp' as const,
            sectionValue: () => ({}),
            onAssist: vi.fn(),
            sectionHasContent: false,
            ...assist,
          },
        }
      : {}),
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

it('warns on the evidence bank too, where the assistant lives outside the stepper', async () => {
  const { EvidenceBankEditor } = await import('@/components/ops/EvidenceBankEditor')
  const { emptyEvidenceBankDraft } = await import('@/components/ops/setupTypes')

  render(
    React.createElement(EvidenceBankEditor, {
      initial: emptyEvidenceBankDraft({ verifiedClaims: [], facts: [], rejectedClaims: [] }),
      today: '2026-09-11',
      sitePagesFetchedAt: null,
    }),
  )

  const hints = screen.getAllByText(
    /No site pages fetched yet — the assistant drafts from your site\./,
  )
  expect(hints.length).toBeGreaterThan(0)
  expect(hints[0].textContent).toContain('Fetch them on the Workspace step.')
})

it('says nothing once pages are fetched, or on a step with no assistant', () => {
  render(stepper({ sitePagesFetchedAt: '2026-09-01T10:00:00.000Z' }))
  expect(screen.queryByText(/No site pages fetched yet/)).toBeNull()

  cleanup()
  render(stepper({ sitePagesFetchedAt: null }, { step: 1 }))
  expect(screen.queryByText(/No site pages fetched yet/)).toBeNull()
})

/**
 * The brand voice is the one setup asset with no assistant, so its editor
 * passes none — and the box, notes, and buttons must all go with it rather
 * than sitting there doing nothing.
 */
it('offers no assistant at all to an asset that has none', () => {
  render(stepper(null))

  expect(screen.queryByRole('button', { name: 'Draft with AI' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refine with AI' })).toBeNull()
  expect(screen.queryByText(/No site pages fetched yet/)).toBeNull()
  expect(screen.getByRole('list', { name: 'Setup progress' })).toBeTruthy()
})
