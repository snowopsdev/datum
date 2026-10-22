import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * F4: the armed-confirm slot, Undo and the reasoned send-back, rendered with
 * the real `useReviewAction` so the slot is genuinely shared between panels.
 */
const { toastSuccess, toastDismiss, sendBackMock, archiveMock, unarchiveMock } = vi.hoisted(() => ({
  toastSuccess: vi.fn(() => 'toast-1'),
  toastDismiss: vi.fn(),
  sendBackMock: vi.fn(async () => undefined),
  archiveMock: vi.fn(async () => undefined),
  unarchiveMock: vi.fn(async () => undefined),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@payloadcms/ui', () => ({ toast: { success: toastSuccess, dismiss: toastDismiss } }))
vi.mock('@/components/ops/actions', () => ({
  archiveArticleAction: archiveMock,
  assignTemplateAction: vi.fn(),
  regenerateArticleAction: vi.fn(),
  resetToDraftedAction: vi.fn(),
  sendBackAction: sendBackMock,
  unarchiveArticleAction: unarchiveMock,
}))
vi.mock('@/components/ops/briefActions', () => ({ revisitBriefAction: vi.fn() }))
vi.mock('@/components/ops/runQueued', () => ({ announceRunQueued: vi.fn() }))

const { useReviewAction } = await import('@/components/ops/review/useReviewAction')
const { ArchiveAction } = await import('@/components/ops/review/ArchiveAction')
const { SendBackAction } = await import('@/components/ops/review/SendBackAction')
const { NeedsRevisionPanel } = await import('@/components/ops/review/panels/NeedsRevisionPanel')

const article = {
  id: 1,
  status: 'needs_revision',
  archived: false,
  reviewNotes: null,
  revisionCount: 0,
  qaResults: null,
  evidenceCitations: [],
}

function Page() {
  const action = useReviewAction()
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(NeedsRevisionPanel, {
      action,
      activeRunIncludesArticle: false,
      article,
      editHref: '/x',
      mode: 'mock',
      run: null,
      runIsCurrent: false,
      scheduleExpired: false,
      scoreInvalidatedBy: null,
      templates: [],
    } as never),
    action.notice
      ? React.createElement(
          'p',
          { role: 'status' },
          typeof action.notice === 'string' ? action.notice : action.notice.text,
          action.undo
            ? React.createElement(
                'button',
                { type: 'button', 'data-notice-undo': '', onClick: action.runUndo },
                action.undo.label,
              )
            : null,
        )
      : null,
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

const confirms = () => screen.queryAllByRole('button', { name: /^Confirm/ })

it('Archive acts at once and backs out of a confirm armed elsewhere', async () => {
  render(React.createElement(Page))
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate from gaps' }))
  expect(confirms().map((b) => b.textContent)).toEqual(['Confirm: discard draft & regenerate'])

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  })
  expect(confirms()).toHaveLength(0)
  expect(archiveMock).toHaveBeenCalledWith(1)
})

it('Escape disarms and focus returns to the trigger', () => {
  render(React.createElement(Page))
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate from gaps' }))
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Confirm: discard draft & regenerate' }),
  )

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(confirms()).toHaveLength(0)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Regenerate from gaps' }))
})

it('Archive offers Undo, toasts it, and Undo unarchives', async () => {
  render(React.createElement(Page))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  })
  expect(archiveMock).toHaveBeenCalledWith(1)
  expect(toastSuccess).toHaveBeenCalledWith(
    'Archived',
    expect.objectContaining({ duration: 8000, action: expect.objectContaining({ label: 'Undo' }) }),
  )
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  })
  expect(unarchiveMock).toHaveBeenCalledWith(1)
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
})

it('Send back is disabled until a reason is entered, and a chip prefills an empty one', async () => {
  const Harness = () => {
    const action = useReviewAction()
    return React.createElement(SendBackAction, { action, articleId: 1 })
  }
  render(React.createElement(Harness))
  const send = () => screen.getByRole('button', { name: 'Send back' }) as HTMLButtonElement
  expect(send().disabled).toBe(true)

  fireEvent.change(screen.getByLabelText(/Why is it going back/), { target: { value: '   ' } })
  expect(send().disabled).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: 'Weak evidence' }))
  expect((screen.getByLabelText(/Why is it going back/) as HTMLTextAreaElement).value).toBe(
    'Weak evidence',
  )
  expect(send().disabled).toBe(false)

  // Armed confirm, no Undo; the chip code goes with the reason.
  fireEvent.click(send())
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: send back' }))
  })
  expect(sendBackMock).toHaveBeenCalledWith(1, 'Weak evidence', 'weak_evidence')
  expect(toastSuccess).not.toHaveBeenCalled()
})

it('renders ArchiveAction as archived once archived', () => {
  const Harness = () =>
    React.createElement(ArchiveAction, { action: useReviewAction(), archived: true, articleId: 1 })
  render(React.createElement(Harness))
  expect(screen.getByText(/Archived — hidden/)).toBeTruthy()
})
