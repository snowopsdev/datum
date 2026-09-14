import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { emptyBrandVoiceContent } from '@/lib/brandVoice'
import type { BrandVoiceDTO, BrandVoiceInput } from '@/components/ops/brandVoiceTypes'

/**
 * The brand voice editor's own rules, the ones the shared stepper cannot know:
 * when the entry cards come back, when an incomplete active voice must say so,
 * and what a save writes to the resume marker.
 */

const saveBrandVoiceDraftAction = vi.fn(async (_id: number, _input: BrandVoiceInput) => undefined)
const deleteDraftAction = vi.fn(async (_id: number) => undefined)

vi.mock('@/components/ops/brandVoiceActions', () => ({
  activateBrandVoiceAction: vi.fn(async () => ({ ok: true })),
  archiveBrandVoiceAction: vi.fn(async () => undefined),
  createBrandVoiceDraftAction: vi.fn(async () => ({ id: 7 })),
  deleteDraftAction: (id: number) => deleteDraftAction(id),
  extractBrandVoiceFromUploadAction: vi.fn(),
  saveBrandVoiceDraftAction: (id: number, input: BrandVoiceInput) =>
    saveBrandVoiceDraftAction(id, input),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}))

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
  render(editor({ records: [draft], selectedId: 1, initialMode: 'guide' }))

  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveBrandVoiceDraftAction).toHaveBeenCalled())
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[0]).toBe(1)
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[1].onboardingStep).toBe(2)
})

it('advances the resume marker when the save comes from a question', async () => {
  const draft = dto({ status: 'draft', onboardingStep: 2 })
  render(editor({ records: [draft], selectedId: 1, initialMode: 'onboarding' }))

  // Resumes on question 3 (index 2); saving there answers it.
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(saveBrandVoiceDraftAction).toHaveBeenCalled())
  expect(saveBrandVoiceDraftAction.mock.calls[0]?.[1].onboardingStep).toBe(3)
})
