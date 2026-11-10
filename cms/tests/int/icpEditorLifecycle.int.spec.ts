// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ownedKey, storageKey } from '@/components/ops/dirtyGuardCore'
import { ICP_STEPS } from '@/components/ops/icpTypes'
import { ICP_FIXTURE } from '@/lib/tenant/fixtures'

/**
 * The audience editor's save lifecycle: a failed call shows instead of
 * vanishing, the first save of a new audience carries the step across the
 * remount its new URL causes, and an activation result is not lost with it.
 */
const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  saveAndActivate: vi.fn(),
  archive: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace, push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement('a', { href }, children),
}))
vi.mock('@payloadcms/ui', () => ({
  toast: { success: mocks.toastSuccess, dismiss: vi.fn() },
  useAuth: () => ({ user: { id: 1 } }),
}))
vi.mock('@/components/ops/setupActions', () => ({ assistAction: vi.fn() }))
vi.mock('@/components/ops/tenantActions', () => ({
  archiveIcpAction: mocks.archive,
  createIcpAction: mocks.create,
  deleteIcpDraftAction: mocks.remove,
  saveAndActivateIcpAction: mocks.saveAndActivate,
  saveIcpAction: mocks.save,
}))

const { IcpEditor } = await import('@/components/ops/IcpEditor')

const REVIEW = ICP_STEPS.length - 1
const LIST = '/admin/ops/setup/audiences'

/** A complete, unsaved new audience: the form's own local copy, restored on mount. */
const seedNewAudience = () =>
  localStorage.setItem(
    storageKey(ownedKey(1, 'icp:new')),
    JSON.stringify({ value: ICP_FIXTURE, savedAt: null, at: Date.now() }),
  )

const editor = (props: Record<string, unknown> = {}) =>
  render(
    React.createElement(IcpEditor, {
      record: null,
      sitePagesFetchedAt: null,
      hasOtherActiveAudience: true,
      ...props,
    } as never),
  )

const draftRecord = {
  ...ICP_FIXTURE,
  id: 3,
  status: 'draft' as const,
  primary: false,
  updatedAt: '2026-09-01T10:00:00.000Z',
  updatedAtLabel: '1 Sep 2026',
  editHref: '/admin/collections/icps/3',
}

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach((mock) => mock.mockReset())
})
afterEach(cleanup)

it('opens on the step in the URL', () => {
  editor({ initialStep: 2 })
  expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(ICP_STEPS[2].title)
  const current = screen
    .getAllByRole('button')
    .filter((b) => b.getAttribute('aria-current') === 'step')
  expect(current).toHaveLength(1)
  expect(current[0].textContent).toContain(ICP_STEPS[2].title)
})

it('shows a first save that fails to reach the server instead of doing nothing', async () => {
  seedNewAudience()
  mocks.create.mockRejectedValue(new Error('Failed to fetch'))
  editor({ initialStep: 3 })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Failed to fetch')
  expect(mocks.replace).not.toHaveBeenCalled()
})

it('keeps the step when the first save moves a new audience to its own URL', async () => {
  seedNewAudience()
  mocks.create.mockResolvedValue({
    ok: true,
    id: 9,
    saved: ICP_FIXTURE,
    dropped: 0,
    updatedAt: '2026-09-02T10:00:00.000Z',
  })
  editor({ initialStep: 3 })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(mocks.replace).toHaveBeenCalledWith(`${LIST}/9?step=3`)
})

it('announces a successful activation with a toast, which outlives the remount', async () => {
  seedNewAudience()
  mocks.saveAndActivate.mockResolvedValue({
    ok: true,
    id: 9,
    status: 'active',
    primary: false,
    saved: ICP_FIXTURE,
    dropped: 0,
    updatedAt: '2026-09-02T10:00:00.000Z',
  })
  editor({ initialStep: REVIEW })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }))
  })
  expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Active/))
  expect(mocks.replace).toHaveBeenCalledWith(`${LIST}/9?step=${REVIEW}`)
})

it('carries an activation error across the first-save remount, then shows it once', async () => {
  seedNewAudience()
  mocks.saveAndActivate.mockResolvedValue({
    ok: false,
    id: 9,
    error: 'An active audience needs a pain.',
  })
  editor({ initialStep: REVIEW })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }))
  })
  // Only a flag travels in the URL; the page recomputes the message on arrival.
  expect(mocks.replace).toHaveBeenCalledWith(`${LIST}/9?step=${REVIEW}&activateFailed=1`)
  expect(mocks.toastSuccess).not.toHaveBeenCalled()

  // The page that arrives gets it as a prop, shows it, and takes it out of the URL.
  cleanup()
  mocks.replace.mockReset()
  editor({
    record: draftRecord,
    initialStep: REVIEW,
    initialError: 'An active audience needs a pain.',
  })
  expect((await screen.findByRole('alert')).textContent).toBe('An active audience needs a pain.')
  expect(mocks.replace).toHaveBeenCalledWith(`${LIST}/3?step=${REVIEW}`)
})

it('shows an activation that never reached the server', async () => {
  seedNewAudience()
  mocks.saveAndActivate.mockRejectedValue(new Error('Server action not found'))
  editor({ initialStep: REVIEW })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }))
  })
  expect((await screen.findByRole('alert')).textContent).toContain('Server action not found')
})

it('asks the server to save against the version the form was opened on', async () => {
  mocks.save.mockResolvedValue({
    ok: true,
    problems: [],
    saved: ICP_FIXTURE,
    dropped: 0,
    updatedAt: '2026-09-03T10:00:00.000Z',
  })
  editor({ record: draftRecord })
  fireEvent.change(screen.getByLabelText(/^Who are they, in one line\?/), {
    target: { value: 'Changed.' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  })
  expect(mocks.save).toHaveBeenCalledWith(3, expect.anything(), '2026-09-01T10:00:00.000Z')
})

it('moves focus with the delete confirmation, and back again', async () => {
  editor({ record: draftRecord })
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep it' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete draft' }))
})

// The content write lands before the activation gate refuses, which moves the
// record's `updatedAt`. The next Save must be compared against that version,
// or the editor refuses its own write as "someone else saved this".
it('adopts the version a refused activation wrote, so the next Save is not stale', async () => {
  mocks.saveAndActivate.mockResolvedValue({
    ok: false,
    id: 3,
    error: 'Another audience was activated first.',
    saved: ICP_FIXTURE,
    updatedAt: '2026-09-03T12:00:00.000Z',
  })
  mocks.save.mockResolvedValue({
    ok: true,
    saved: ICP_FIXTURE,
    dropped: 0,
    problems: [],
    updatedAt: '2026-09-03T12:05:00.000Z',
  })
  editor({ record: draftRecord, initialStep: REVIEW })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Save and activate' }))
  })
  expect((await screen.findByRole('alert')).textContent).toContain('activated first')
  await act(async () => {
    fireEvent.click(
      screen.getAllByRole('button').find((b) => b.textContent?.includes(ICP_STEPS[0].title))!,
    )
  })
  await act(async () => {
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'An edited answer' } })
  })
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: /^Save( \d+ changes?)?$/ })[0])
  })
  expect(mocks.save).toHaveBeenCalledWith(3, expect.anything(), '2026-09-03T12:00:00.000Z')
})
