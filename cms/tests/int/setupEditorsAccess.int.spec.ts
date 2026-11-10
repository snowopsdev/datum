// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * Setup editors: what a screen-reader user is told, and what the editors do
 * when a server call fails or the form is not saved.
 */
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  assist: vi.fn(),
  refreshPages: vi.fn(),
  saveBank: vi.fn(),
  saveWorkspace: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))
vi.mock('@payloadcms/ui', () => ({
  toast: { success: vi.fn(), dismiss: vi.fn() },
  useAuth: () => ({ user: { id: 1 } }),
}))
vi.mock('@/components/ops/setupActions', () => ({
  assistAction: mocks.assist,
  refreshSitePagesAction: mocks.refreshPages,
}))
vi.mock('@/components/ops/tenantActions', () => ({
  saveEvidenceBankAction: mocks.saveBank,
  saveWorkspaceProfileAction: mocks.saveWorkspace,
}))
vi.mock('@/components/ops/sourceReviewActions', () => ({
  approveCandidateAction: vi.fn(),
  dismissCandidateAction: vi.fn(),
  reopenCandidateAction: vi.fn(),
}))

const { TextRows } = await import('@/components/ops/setupFields')
const { AssetStepper } = await import('@/components/ops/AssetStepper')
const { SetupWorkspaceEditor } = await import('@/components/ops/SetupWorkspaceEditor')
const { EvidenceBankEditor } = await import('@/components/ops/EvidenceBankEditor')
const { SourceReviewQueue } = await import('@/components/ops/SourceReviewQueue')

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((mock) => mock.mockReset())
})
afterEach(cleanup)

it('TextRows names every input and Remove button by its label and row number', () => {
  const onChange = vi.fn()
  render(
    React.createElement(TextRows, {
      id: 'pains',
      label: 'Churn triggers',
      rows: ['price rise', 'new manager'],
      onChange,
      disabled: false,
      addLabel: 'Add one',
    }),
  )
  const group = screen.getByRole('group', { name: 'Churn triggers' })
  expect(within(group).getByRole('textbox', { name: 'Churn triggers 1' })).toBeTruthy()
  expect(within(group).getByRole('textbox', { name: 'Churn triggers 2' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Churn triggers 2' }))
  expect(onChange).toHaveBeenCalledWith(['price rise'])
})

const steps = [
  { id: 'who', title: 'Who', blurb: 'Who.', assist: 'who' },
  { id: 'review', title: 'Review', blurb: 'Check.' },
] as const

it('marks the current step in the rail', () => {
  render(
    React.createElement(AssetStepper, {
      heading: 'H',
      lede: 'L',
      steps,
      step: 1,
      onStep: vi.fn(),
      disabled: false,
      actions: null,
      children: null,
    } as never),
  )
  const rail = screen.getByRole('list', { name: 'Setup progress' })
  expect(
    within(rail)
      .getByRole('button', { name: /Review/ })
      .getAttribute('aria-current'),
  ).toBe('step')
  expect(within(rail).getByRole('button', { name: /Who/ }).getAttribute('aria-current')).toBeNull()
})

it('shows an assistant call that fails to reach the server', async () => {
  mocks.assist.mockRejectedValue(new Error('Failed to fetch'))
  render(
    React.createElement(AssetStepper, {
      heading: 'H',
      lede: 'L',
      steps,
      step: 0,
      onStep: vi.fn(),
      assist: {
        asset: 'icp',
        sectionValue: () => ({}),
        onAssist: vi.fn(),
        sectionHasContent: false,
      },
      disabled: false,
      actions: null,
      children: null,
    } as never),
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))
  })
  expect(await screen.findByText('Failed to fetch')).toBeTruthy()
})

const workspace = {
  companyName: 'Acme',
  targetDomain: 'acme.com',
  siteNotes: '',
  competitors: [],
  sitePages: [],
  sitePagesFetchedLabel: null,
  fallbackDomain: null,
  fallbackSource: 'admin' as const,
  problems: [],
  updatedAt: '2026-09-01T10:00:00.000Z',
}
const openPagesStep = () =>
  fireEvent.click(screen.getByRole('button', { name: /Your site, in Datum/ }))

it('will not fetch site pages while the form has unsaved changes, and says why', () => {
  render(React.createElement(SetupWorkspaceEditor, workspace))
  fireEvent.change(screen.getByLabelText('Target domain'), { target: { value: 'other.com' } })
  openPagesStep()
  const fetch = screen.getByRole('button', { name: 'Fetch site pages' }) as HTMLButtonElement
  expect(fetch.disabled).toBe(true)
  expect(screen.getByText(/Save first/).textContent).toContain('acme.com')
})

it('fetches from the saved domain, and the message names it', async () => {
  mocks.refreshPages.mockResolvedValue({ ok: true, pages: 4, warnings: [], domain: 'acme.com' })
  render(React.createElement(SetupWorkspaceEditor, workspace))
  openPagesStep()
  const fetch = screen.getByRole('button', { name: 'Fetch site pages' }) as HTMLButtonElement
  expect(fetch.disabled).toBe(false)
  expect(screen.queryByText(/Save first/)).toBeNull()
  await act(async () => {
    fireEvent.click(fetch)
  })
  expect(await screen.findByText('Fetched 4 pages from acme.com.')).toBeTruthy()
})

it('shows a site fetch that throws instead of reaching the error boundary', async () => {
  mocks.refreshPages.mockRejectedValue(new Error('Failed to fetch'))
  render(React.createElement(SetupWorkspaceEditor, workspace))
  openPagesStep()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Fetch site pages' }))
  })
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to fetch')
})

const bankWithClaim = {
  verifiedClaims: [
    {
      ref: 'E1',
      claim: 'We cut review time in half.',
      primarySource: 'Case study',
      sourceUrl: 'https://example.com/case',
      sourceDate: '2026-01-01',
      sampleOrMethod: 'n=12',
      verificationDepth: 'self_reported' as const,
      limits: '',
      clearedSurfaces: [],
      recheckAt: '',
    },
  ],
  facts: [],
  rejectedClaims: [],
}

it('evidence bank: tabs say which is open, and cleared surfaces are a named group', () => {
  render(
    React.createElement(EvidenceBankEditor, {
      initial: bankWithClaim,
      today: '2026-09-11',
      sitePagesFetchedAt: null,
    }),
  )
  expect(screen.getByRole('button', { name: /^Claims/ }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: /^Facts/ }).getAttribute('aria-pressed')).toBe('false')
  const group = screen.getByRole('group', { name: 'Where it can be used' })
  expect(within(group).getAllByRole('checkbox').length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: /^Facts/ }))
  expect(screen.getByRole('button', { name: /^Facts/ }).getAttribute('aria-pressed')).toBe('true')
})

it('evidence bank: saves against its version and shows a refusal and a failed call', async () => {
  mocks.saveBank.mockResolvedValueOnce({
    ok: false,
    error: 'Someone else saved this since you opened it. Reload to see their changes.',
  })
  render(
    React.createElement(EvidenceBankEditor, {
      initial: bankWithClaim,
      updatedAt: '2026-09-01T10:00:00.000Z',
      today: '2026-09-11',
      sitePagesFetchedAt: null,
    }),
  )
  fireEvent.change(screen.getAllByRole('textbox')[0], {
    target: { value: 'We halved review time.' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(mocks.saveBank).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    '2026-09-01T10:00:00.000Z',
  )
  expect((await screen.findByRole('alert')).textContent).toContain('Someone else saved this')

  mocks.saveBank.mockRejectedValueOnce(new Error('Failed to fetch'))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect((await screen.findByRole('alert')).textContent).toContain('Failed to fetch')
})

const candidate = (id: number, status: 'pending' | 'approved' | 'dismissed') => ({
  id,
  domain: `site-${id}.example`,
  status,
  suggestedClass: 'secondary' as const,
  citationCount: 1,
  serpCount: 0,
  domainRating: null,
  lastSeenLabel: '1 Sep 2026',
  serpBadges: [],
  hiddenSerpBadges: 0,
  citedBy: [],
  coveredBy: null,
  resolvedBy: null,
})

it('source review: tab labels use the database totals, and the cap is stated', () => {
  render(
    React.createElement(SourceReviewQueue, {
      candidates: [candidate(1, 'pending'), candidate(2, 'pending'), candidate(3, 'dismissed')],
      totals: { review: 450, rated: 0, dismissed: 1 },
    }),
  )
  const review = screen.getByRole('button', { name: 'To review (450)' })
  expect(review.getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Dismissed (1)' }).getAttribute('aria-pressed')).toBe(
    'false',
  )
  expect(screen.getByRole('status').textContent).toContain('Showing 2 of 450')
  fireEvent.click(screen.getByRole('button', { name: 'Dismissed (1)' }))
  expect(screen.queryByText(/Showing/)).toBeNull()
})
