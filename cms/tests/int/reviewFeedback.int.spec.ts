import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * F4: the armed-confirm slot, Undo and the reasoned send-back, rendered with
 * the real `useReviewAction` so the slot is genuinely shared between panels.
 */
const {
  toastSuccess,
  toastDismiss,
  sendBackMock,
  archiveMock,
  unarchiveMock,
  unscheduleMock,
  scheduleMock,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(() => 'toast-1'),
  toastDismiss: vi.fn(),
  sendBackMock: vi.fn(async () => undefined),
  archiveMock: vi.fn(async () => undefined),
  unarchiveMock: vi.fn(async () => undefined),
  unscheduleMock: vi.fn(async () => ({ previousPublishAt: null as string | null })),
  scheduleMock: vi.fn(async () => ({ publishAt: '' })),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@payloadcms/ui', () => ({ toast: { success: toastSuccess, dismiss: toastDismiss } }))
vi.mock('@/components/ops/actions', () => ({
  archiveArticleAction: archiveMock,
  assignTemplateAction: vi.fn(),
  regenerateArticleAction: vi.fn(),
  publishArticleAction: vi.fn(),
  resetToDraftedAction: vi.fn(),
  scheduleArticleAction: scheduleMock,
  sendBackAction: sendBackMock,
  unarchiveArticleAction: unarchiveMock,
  unscheduleArticleAction: unscheduleMock,
}))
vi.mock('@/components/ops/briefActions', () => ({ revisitBriefAction: vi.fn() }))
vi.mock('@/components/ops/runQueued', () => ({ announceRunQueued: vi.fn() }))

const { useReviewAction } = await import('@/components/ops/review/useReviewAction')
const { ArchiveAction } = await import('@/components/ops/review/ArchiveAction')
const { SendBackAction } = await import('@/components/ops/review/SendBackAction')
const { NeedsRevisionPanel } = await import('@/components/ops/review/panels/NeedsRevisionPanel')
const { ApprovedPanel } = await import('@/components/ops/review/panels/ApprovedPanel')

const article = {
  id: 1,
  status: 'needs_revision',
  archived: false,
  reviewNotes: null,
  revisionCount: 0,
  qaResults: null,
  evidenceCitations: [],
}

function Page({ approvedPublishAt }: { approvedPublishAt?: string }) {
  const action = useReviewAction()
  const props = {
    action,
    activeRunIncludesArticle: false,
    editHref: '/x',
    mode: 'mock',
    run: null,
    runIsCurrent: false,
    scheduleExpired: false,
    scoreInvalidatedBy: null,
    templates: [],
  }
  return React.createElement(
    React.Fragment,
    null,
    approvedPublishAt
      ? React.createElement(ApprovedPanel, {
          ...props,
          article: { ...article, status: 'approved', publishAt: approvedPublishAt },
        } as never)
      : React.createElement(NeedsRevisionPanel, { ...props, article } as never),
    action.error ? React.createElement('p', { role: 'alert' }, action.error) : null,
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

it('any other action backs out of an armed confirm, so it cannot outlive the refresh', async () => {
  render(React.createElement(Page))
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate from gaps' }))
  expect(confirms()).toHaveLength(1)

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Revisit brief' }))
  })
  expect(confirms()).toHaveLength(0)
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

it('a failed Undo keeps the notice and its Undo, so it can be retried', async () => {
  unarchiveMock.mockRejectedValueOnce(new Error('Network down'))
  render(React.createElement(Page))
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  })
  expect(screen.getByText('Network down')).toBeTruthy()
  expect(screen.getByText('Archived — it is off the content board.')).toBeTruthy()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
  })
  expect(unarchiveMock).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
})

describe('Unschedule Undo checks the clock, not the rendered page', () => {
  afterEach(() => vi.useRealTimers())

  it('offers no Undo when the removed time has already passed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    unscheduleMock.mockResolvedValueOnce({ previousPublishAt: '2030-01-01T11:00:00.000Z' })
    render(React.createElement(Page, { approvedPublishAt: '2030-01-01T11:00:00.000Z' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unschedule' }))
    })
    expect(screen.getByText(/Unscheduled/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull()
  })

  it('an Undo in time reschedules and puts the time back in the input', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    unscheduleMock.mockResolvedValueOnce({ previousPublishAt: '2030-01-01T12:05:00.000Z' })
    const { container } = render(
      React.createElement(Page, { approvedPublishAt: '2030-01-01T12:05:00.000Z' }),
    )
    const input = () => container.querySelector<HTMLInputElement>('#publish-at')!
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unschedule' }))
    })
    expect(input().value).toBe('')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(scheduleMock).toHaveBeenCalledWith(1, '2030-01-01T12:05:00.000Z')
    expect(input().value).toBe('2030-01-01T12:05')
  })

  it('refuses an Undo pressed after the time passed, and keeps it on screen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    unscheduleMock.mockResolvedValueOnce({ previousPublishAt: '2030-01-01T12:05:00.000Z' })
    render(React.createElement(Page, { approvedPublishAt: '2030-01-01T12:05:00.000Z' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unschedule' }))
    })
    vi.setSystemTime(new Date('2030-01-01T12:10:00Z'))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    })
    expect(scheduleMock).not.toHaveBeenCalled()
    expect(screen.getByText(/That time has passed/)).toBeTruthy()
  })
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
