import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { emptyBrandVoiceContent } from '@/lib/brandVoice'
import type { BrandVoiceDTO, BrandVoiceInput } from '@/components/ops/brandVoiceTypes'

/**
 * The brand voice editor's own rules, the ones the shared stepper cannot know:
 * when the entry cards come back, when an incomplete active voice must say so,
 * and what a save writes to the resume marker.
 */

const saveBrandVoiceDraftAction = vi.fn(async (_id: number, _input: BrandVoiceInput) => ({
  updatedAt: '2030-01-01T00:00:00.000Z',
}))
const deleteDraftAction = vi.fn(async (_id: number) => undefined)
const archiveBrandVoiceAction = vi.fn(async (_id: number) => undefined)

vi.mock('@/components/ops/brandVoiceActions', () => ({
  activateBrandVoiceAction: vi.fn(async () => ({ ok: true })),
  archiveBrandVoiceAction: (id: number) => archiveBrandVoiceAction(id),
  createBrandVoiceDraftAction: vi.fn(async () => ({ id: 7, updatedAt: '2030-01-01T00:00:00.000Z' })),
  deleteDraftAction: (id: number) => deleteDraftAction(id),
  extractBrandVoiceFromUploadAction: vi.fn(),
  saveBrandVoiceDraftAction: (id: number, input: BrandVoiceInput) =>
    saveBrandVoiceDraftAction(id, input),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))
vi.mock('@payloadcms/ui', () => ({ toast: { success: vi.fn(), dismiss: vi.fn() } }))

const { BrandVoiceEditor } = await import('@/components/ops/BrandVoiceEditor')

/** A voice with every activation answer filled in, so `problems` is empty. */
function completeContent() {
  const content = emptyBrandVoiceContent('Acme voice')
  content.essence.oneLiner = 'Acme helps clinics bill without an accountant.'
  content.coreValues = [
    { value: 'Trust', description: '' },
    { value: 'Speed', description: '' },
    { value: 'Clarity', description: '' },
  ]
  content.persona = 'The colleague who has already done it.'
  content.voiceAdjectives = [
    { adjective: 'Plain', description: '', doExample: '', dontExample: '' },
    { adjective: 'Warm', description: '', doExample: '', dontExample: '' },
    { adjective: 'Direct', description: '', doExample: '', dontExample: '' },
  ]
  content.notTraits = [{ trait: 'Sarcastic', boundaryNote: '' }]
  return content
}

function dto(over: Partial<BrandVoiceDTO> = {}): BrandVoiceDTO {
  return {
    ...completeContent(),
    id: 1,
    status: 'active',
    source: 'onboarding',
    onboardingStep: 9,
    activatedAt: '2026-09-01T10:00:00.000Z',
    activatedBy: 'system',
    sourceFile: null,
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...over,
  }
}

const editor = (props: Partial<Parameters<typeof BrandVoiceEditor>[0]> = {}) =>
  React.createElement(BrandVoiceEditor, {
    records: [],
    selectedId: null,
    auditEntries: [],
    initialMode: null,
    ...props,
  })

beforeEach(() => {
  saveBrandVoiceDraftAction.mockClear()
  deleteDraftAction.mockClear()
  archiveBrandVoiceAction.mockClear()
})
afterEach(cleanup)

it('offers the entry cards to a workspace with no voice, and the rail once one is started', () => {
  const { rerender } = render(editor())

  expect(screen.getByRole('button', { name: 'Start onboarding' })).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Setup progress' })).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Start onboarding' }))
  expect(screen.getByRole('list', { name: 'Setup progress' })).toBeTruthy()

  // The rail survives a server re-render that still has nothing saved.
  rerender(editor())
  expect(screen.getByRole('list', { name: 'Setup progress' })).toBeTruthy()
})

it('puts the entry cards back after the last voice is deleted', async () => {
  const record = dto({ status: 'draft', onboardingStep: 3 })
  const { rerender } = render(editor({ records: [record], selectedId: 1 }))

  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
  await waitFor(() => expect(deleteDraftAction).toHaveBeenCalledWith(1))

  // What the server sends back once the row is gone.
  rerender(editor({ records: [], selectedId: null }))
  expect(screen.getByRole('button', { name: 'Start onboarding' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Upload & extract' })).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Setup progress' })).toBeNull()
})

it('says on every step why an incomplete active voice cannot be saved', () => {
  const incomplete = dto({ persona: '' })
  render(editor({ records: [incomplete], selectedId: 1 }))

  // The review step lists them itself, once.
  expect(screen.getAllByText('Describe the human persona')).toHaveLength(1)
  expect(
    screen.getByText('Fix before saving — an active voice must stay complete'),
  ).toBeTruthy()

  // And a question step, where the checklist used to disappear entirely.
  fireEvent.click(screen.getByRole('button', { name: /Human persona/ }))
  expect(screen.getAllByText('Describe the human persona')).toHaveLength(1)
  expect(
    screen.getByText('Fix before saving — an active voice must stay complete'),
  ).toBeTruthy()
})

it('leaves the resume marker alone when a save comes from a read-only step', async () => {
  const draft = dto({ status: 'draft', onboardingStep: 2 })
  render(editor({ records: [draft], selectedId: 1, initialMode: 'onboarding' }))

  // Save is for what has changed: edit question 3, then read the guide.
  fireEvent.change(screen.getByLabelText('Who are you talking to?'), {
    target: { value: 'Clinic managers' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Export guide/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveBrandVoiceDraftAction).toHaveBeenCalled())
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[0]).toBe(1)
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[1].onboardingStep).toBe(2)
})

it('advances the resume marker when the save comes from a question', async () => {
  const draft = dto({ status: 'draft', onboardingStep: 2 })
  render(editor({ records: [draft], selectedId: 1, initialMode: 'onboarding' }))

  // Resumes on question 3 (index 2); saving there answers it.
  fireEvent.change(screen.getByLabelText('Who are you talking to?'), {
    target: { value: 'Clinic managers' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveBrandVoiceDraftAction).toHaveBeenCalled())
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[1].onboardingStep).toBe(3)
})

it('arms archive before it archives the active voice, and Escape backs out', () => {
  render(editor({ records: [dto({ id: 1 })], selectedId: 1, initialMode: 'review' }))

  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  expect(archiveBrandVoiceAction).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Confirm: archive' })).toBeTruthy()
  // Focus lands on Cancel, the safe choice, rather than on the archive itself.
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('button', { name: 'Confirm: archive' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Archive' })).toBeTruthy()
  expect(archiveBrandVoiceAction).not.toHaveBeenCalled()
})

it('archives on the confirming click and says runs are blocked until another voice is active', async () => {
  render(editor({ records: [dto({ id: 1 })], selectedId: 1, initialMode: 'review' }))

  fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm: archive' }))

  await waitFor(() => expect(archiveBrandVoiceAction).toHaveBeenCalledWith(1))
  expect(
    await screen.findByText('Archived. Runs are blocked until you activate another voice.'),
  ).toBeTruthy()
})

it('says activating a voice archives the one that is active now', () => {
  const active = dto({ id: 1, name: 'Acme voice' })
  const archived = dto({ id: 2, name: 'Old voice', status: 'archived' })
  render(editor({ records: [active, archived], selectedId: 2, initialMode: 'review' }))

  expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy()
  expect(screen.getByText(/Activating this archives “Acme voice”/)).toBeTruthy()
})

it('says nothing about archiving on activate when no other voice is active', () => {
  render(
    editor({
      records: [dto({ id: 2, name: 'Old voice', status: 'archived' })],
      selectedId: 2,
      initialMode: 'review',
    }),
  )

  expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy()
  expect(screen.queryByText(/Activating this archives/)).toBeNull()
})

it('offers no "Save and leave" when the voice cannot be saved as it stands', async () => {
  const incomplete = dto({ persona: '' })
  render(
    React.createElement(
      React.Fragment,
      null,
      editor({ records: [incomplete], selectedId: 1 }),
      React.createElement('a', { href: '/admin/ops/content' }, 'Content'),
    ),
  )
  // Any edit: the persona it is missing keeps Save refused either way.
  fireEvent.click(screen.getByRole('button', { name: /Target audience/ }))
  fireEvent.change(screen.getByLabelText('Who are you talking to?'), {
    target: { value: 'Clinic managers' },
  })

  fireEvent.click(screen.getByRole('link', { name: 'Content' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).queryByRole('button', { name: 'Save and leave' })).toBeNull()
  expect(within(dialog).getByRole('button', { name: 'Leave' })).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: 'Stay' })).toBeTruthy()
})

it('tags an edit made after a save with the version that save returned', async () => {
  localStorage.clear()
  const draft = dto({ status: 'draft', onboardingStep: 9 })
  render(editor({ records: [draft], selectedId: 1, initialMode: 'onboarding' }))
  const who = () => screen.getByLabelText('Who are you talking to?')
  fireEvent.click(screen.getByRole('button', { name: /Target audience/ }))

  fireEvent.change(who(), { target: { value: 'Clinic managers' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveBrandVoiceDraftAction).toHaveBeenCalled())

  fireEvent.change(who(), { target: { value: 'Clinic owners' } })
  await waitFor(
    () => {
      const raw = localStorage.getItem('datum:draft:brand-voice:1')
      expect(raw && JSON.parse(raw).savedAt).toBe('2030-01-01T00:00:00.000Z')
    },
    { timeout: 2000 },
  )
})
