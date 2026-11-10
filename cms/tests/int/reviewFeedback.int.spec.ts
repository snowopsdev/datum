// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * F4: the armed-confirm slot, Undo and the reasoned send-back, rendered with
 * the real `useReviewAction` so the slot is genuinely shared between panels.
 */
type ActionOutcome = { ok: true; [key: string]: unknown } | { ok: false; error: string }

const {
  toastSuccess,
  toastDismiss,
  sendBackMock,
  archiveMock,
  unarchiveMock,
  unscheduleMock,
  scheduleMock,
  publishMock,
  resetMock,
  revisitMock,
} = vi.hoisted(() => ({
  toastSuccess: vi.fn(() => 'toast-1'),
  toastDismiss: vi.fn(),
  sendBackMock: vi.fn(async (..._args: unknown[]): Promise<ActionOutcome> => ({ ok: true })),
  archiveMock: vi.fn(async (..._args: unknown[]): Promise<ActionOutcome> => ({ ok: true })),
  unarchiveMock: vi.fn(async (..._args: unknown[]): Promise<ActionOutcome> => ({ ok: true })),
  unscheduleMock: vi.fn(async () => ({ ok: true as const, previousPublishAt: null as string | null })),
  scheduleMock: vi.fn(async (..._args: unknown[]) => ({ ok: true as const, publishAt: '' })),
  publishMock: vi.fn(
    async (..._args: unknown[]): Promise<ActionOutcome> => ({
      ok: true,
      status: 'published',
      slug: 'cold-brew',
    }),
  ),
  resetMock: vi.fn(
    async (..._args: unknown[]): Promise<ActionOutcome> => ({ ok: true, queued: false }),
  ),
  revisitMock: vi.fn(async (..._args: unknown[]) => ({ ok: true as const, message: '' })),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock('@payloadcms/ui', () => ({ toast: { success: toastSuccess, dismiss: toastDismiss } }))
vi.mock('@/components/ops/actions', () => ({
  archiveArticleAction: archiveMock,
  assignTemplateAction: vi.fn(),
  regenerateArticleAction: vi.fn(),
  publishArticleAction: publishMock,
  approveArticleAction: vi.fn(),
  resetToDraftedAction: resetMock,
  scheduleArticleAction: scheduleMock,
  sendBackAction: sendBackMock,
  unarchiveArticleAction: unarchiveMock,
  unscheduleArticleAction: unscheduleMock,
}))
vi.mock('@/components/ops/briefActions', () => ({ revisitBriefAction: revisitMock }))
vi.mock('@/components/ops/runQueued', () => ({ announceRunQueued: vi.fn() }))

const { useReviewAction } = await import('@/components/ops/review/useReviewAction')
const { ArchiveAction } = await import('@/components/ops/review/ArchiveAction')
const { SendBackAction } = await import('@/components/ops/review/SendBackAction')
const { NeedsRevisionPanel } = await import('@/components/ops/review/panels/NeedsRevisionPanel')
const { ApprovedPanel } = await import('@/components/ops/review/panels/ApprovedPanel')
const { VerifiedPanel } = await import('@/components/ops/review/panels/VerifiedPanel')
const { PublishedPanel } = await import('@/components/ops/review/panels/PublishedPanel')
const { ReviewDecisionPanel } = await import('@/components/ops/review/panels/ReviewDecisionPanel')

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

beforeEach(() => {
  vi.clearAllMocks()
  // `clearAllMocks` keeps implementations but drops queued `…Once` ones.
  sendBackMock.mockResolvedValue({ ok: true })
})
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
    fireEvent.click(screen.getByRole('button', { name: 'Reset to drafted' }))
  })
  expect(confirms()).toHaveLength(0)
  expect(resetMock).toHaveBeenCalled()
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
  expect(screen.getByText('Archived — it is off the content list.')).toBeTruthy()

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
    unscheduleMock.mockResolvedValueOnce({ ok: true, previousPublishAt: '2030-01-01T11:00:00.000Z' })
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
    unscheduleMock.mockResolvedValueOnce({ ok: true, previousPublishAt: '2030-01-01T12:05:00.000Z' })
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
    unscheduleMock.mockResolvedValueOnce({ ok: true, previousPublishAt: '2030-01-01T12:05:00.000Z' })
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
  expect(screen.getByText('Archived — hidden from the content list.')).toBeTruthy()
})

/** Any panel, on the real `useReviewAction`, with the error and notice shown. */
function PanelPage({
  Panel,
  article: over,
}: {
  Panel: React.ComponentType<never>
  article: Record<string, unknown>
}) {
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
    article: { ...article, ...over },
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(Panel, props as never),
    action.error ? React.createElement('p', { role: 'alert' }, action.error) : null,
    action.notice
      ? React.createElement(
          'p',
          { role: 'status' },
          typeof action.notice === 'string' ? action.notice : action.notice.text,
        )
      : null,
  )
}

// A thrown server-action error is redacted in a production build; the panels
// read { ok: false, error } and throw it themselves, in the browser.
describe('a refused action shows the server’s message', () => {
  it('Send back', async () => {
    sendBackMock.mockResolvedValueOnce({ ok: false, error: 'Say why this is going back.' })
    render(React.createElement(PanelPage, { Panel: ApprovedPanel, article: { status: 'approved' } }))
    fireEvent.change(screen.getByLabelText(/Why is it going back/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm: send back' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('Say why this is going back.')
  })

  it('Archive, with no success notice', async () => {
    archiveMock.mockResolvedValueOnce({
      ok: false,
      error: 'This article is in an active run. Wait for the run to finish before archiving it.',
    })
    render(React.createElement(PanelPage, { Panel: NeedsRevisionPanel, article: {} }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    })
    expect(screen.getByRole('alert').textContent).toMatch(/active run/)
    expect(screen.queryByRole('status')).toBeNull()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('Reset to drafted', async () => {
    resetMock.mockResolvedValueOnce({ ok: false, error: 'This article has not been drafted yet.' })
    render(React.createElement(PanelPage, { Panel: NeedsRevisionPanel, article: {} }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset to drafted' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('This article has not been drafted yet.')
  })
})

describe('publishing asks first, and says it goes live at once', () => {
  const panels = [
    { name: 'Approved', Panel: ApprovedPanel, status: 'approved', trigger: 'Publish now', go: 'Confirm: publish now' },
    {
      name: 'Verified',
      Panel: VerifiedPanel,
      status: 'verified',
      trigger: 'Approve & publish',
      go: 'Confirm: approve & publish',
    },
  ] as const

  for (const { name, Panel, status, trigger, go } of panels) {
    it(`${name}: the first click only arms; Confirm publishes with the notes`, async () => {
      render(React.createElement(PanelPage, { Panel, article: { status, reviewNotes: 'reads well' } }))

      fireEvent.click(screen.getByRole('button', { name: trigger }))
      expect(publishMock).not.toHaveBeenCalled()
      expect(screen.getByText(/public site immediately/)).toBeTruthy()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: go }))

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: go }))
      })
      expect(publishMock).toHaveBeenCalledWith(1, 'reads well')
      expect(screen.getByRole('status').textContent).toMatch(/^Published/)
    })

    it(`${name}: Cancel and Escape publish nothing and give the trigger its focus back`, () => {
      render(React.createElement(PanelPage, { Panel, article: { status } }))

      fireEvent.click(screen.getByRole('button', { name: trigger }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(document.activeElement).toBe(screen.getByRole('button', { name: trigger }))

      fireEvent.click(screen.getByRole('button', { name: trigger }))
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(document.activeElement).toBe(screen.getByRole('button', { name: trigger }))
      expect(publishMock).not.toHaveBeenCalled()
    })
  }

  it('a refused publish shows the gate’s message', async () => {
    publishMock.mockResolvedValueOnce({
      ok: false,
      error: 'An article cannot move from drafted to published.',
    })
    render(React.createElement(PanelPage, { Panel: ApprovedPanel, article: { status: 'approved' } }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish now' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm: publish now' }))
    })
    expect(screen.getByRole('alert').textContent).toBe(
      'An article cannot move from drafted to published.',
    )
  })
})

describe('Revisit brief asks first, and says the draft will be rewritten', () => {
  for (const [name, Panel, article] of [
    ['needs_revision', NeedsRevisionPanel, {}],
    ['needs_review', ReviewDecisionPanel, { status: 'needs_review' }],
  ] as const) {
    it(`${name}: arms, explains, and only Confirm calls the action`, async () => {
      render(React.createElement(PanelPage, { Panel, article }))

      fireEvent.click(screen.getByRole('button', { name: 'Revisit brief' }))
      expect(revisitMock).not.toHaveBeenCalled()
      expect(screen.getByText(/new draft is written once you approve the brief/)).toBeTruthy()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Confirm: revisit brief' }))
      })
      expect(revisitMock).toHaveBeenCalledWith(1)
      // `ok: true` is not an error: nothing is shown, and the confirm is gone.
      expect(screen.queryByRole('alert')).toBeNull()
      expect(confirms()).toHaveLength(0)
    })
  }

  it('shows the action’s refusal, and Cancel calls nothing', async () => {
    revisitMock.mockResolvedValueOnce({ ok: false, error: 'This article is in an active run.' } as never)
    render(React.createElement(PanelPage, { Panel: NeedsRevisionPanel, article: {} }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisit brief' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(revisitMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Revisit brief' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm: revisit brief' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('This article is in an active run.')
  })
})

describe('archiving a live piece says it leaves the site', () => {
  it('the published panel’s Archive is titled and announced accordingly, and Undo is kept', async () => {
    render(
      React.createElement(PanelPage, {
        Panel: PublishedPanel,
        article: { status: 'published', publishedAt: '2026-09-01T10:00:00.000Z' },
      }),
    )
    expect(screen.getByRole('button', { name: 'Archive' }).getAttribute('title')).toMatch(
      /off the public site/,
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    })
    expect(archiveMock).toHaveBeenCalledWith(1)
    expect(screen.getByRole('status').textContent).toBe(
      'Archived — it is off the site and the content list.',
    )
    expect(toastSuccess).toHaveBeenCalledWith(
      'Archived',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
    )
  })

  it('other panels still say only the content list', async () => {
    render(React.createElement(PanelPage, { Panel: NeedsRevisionPanel, article: {} }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    })
    expect(screen.getByRole('status').textContent).toBe('Archived — it is off the content list.')
  })
})
