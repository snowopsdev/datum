import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { ICP_FIXTURE } from '@/lib/tenant/fixtures'

/**
 * An active audience must stay complete: `gateIcpActivation` refuses a save
 * that would leave it otherwise. The editor must not offer one either.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@payloadcms/ui', () => ({
  toast: { success: vi.fn(), dismiss: vi.fn() },
  useAuth: () => ({ user: { id: 1 } }),
}))
vi.mock('@/components/ops/tenantActions', () => ({
  archiveIcpAction: vi.fn(),
  createIcpAction: vi.fn(),
  deleteIcpDraftAction: vi.fn(),
  saveAndActivateIcpAction: vi.fn(),
  saveIcpAction: vi.fn(),
}))

const { IcpEditor } = await import('@/components/ops/IcpEditor')

afterEach(cleanup)

it('offers no save of any kind for an active audience edited into an incomplete one', async () => {
  localStorage.clear()
  render(
    React.createElement(
      React.Fragment,
      null,
      React.createElement(IcpEditor, {
        record: {
          ...ICP_FIXTURE,
          id: 1,
          status: 'active',
          updatedAt: '2026-09-01T10:00:00.000Z',
          updatedAtLabel: '1 Sep 2026',
          editHref: '/admin/collections/icps/1',
        },
        sitePagesFetchedAt: null,
        hasOtherActiveAudience: false,
      }),
      React.createElement('a', { href: '/admin/ops/content' }, 'Content'),
    ),
  )
  fireEvent.change(screen.getByLabelText(/^Who are they, in one line\?/), {
    target: { value: '' },
  })

  expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('link', { name: 'Content' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).queryByRole('button', { name: 'Save and leave' })).toBeNull()
  expect(within(dialog).getByRole('button', { name: 'Leave' })).toBeTruthy()
})
