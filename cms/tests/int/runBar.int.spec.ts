import React from 'react'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunStatusDTO } from '@/components/ops/boardTypes'

const mocks = vi.hoisted(() => {
  const refresh = vi.fn()
  return { poll: vi.fn<() => Promise<RunStatusDTO | null>>(), refresh, router: { refresh } }
})
vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => '/admin/ops/content',
}))
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
}))
vi.mock('@/components/ops/boardActions', () => ({ latestRunAction: mocks.poll }))
const { GlobalRunBar } = await import('@/components/ops/GlobalRunBar')
const { announceRunQueued, isStaleRun } = await import('@/components/ops/runQueued')
const run = (status: RunStatusDTO['status']): RunStatusDTO => ({
  runId: 'test-run',
  status,
  mode: 'mock',
  source: 'selected',
  createdAtIso: new Date().toISOString(),
  startedLabel: 'now',
  startedAtIso: new Date().toISOString(),
  completedAtIso: status === 'succeeded' || status === 'failed' ? new Date().toISOString() : null,
  articleCount: 1,
  articles: [{ id: 1, keyword: 'test article', status: 'drafted' }],
  activity: null,
  finalStatuses: {},
  failures: [],
  errorSummary: null,
})
beforeEach(() => {
  vi.useFakeTimers()
  mocks.poll.mockReset()
  mocks.refresh.mockReset()
  window.localStorage.clear()
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
it('retains successful state after errors and refreshes once on completion', async () => {
  mocks.poll
    .mockResolvedValueOnce(run('running'))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(run('succeeded'))
  render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText(/test article/)).toBeTruthy()
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(screen.getByText(/test article/)).toBeTruthy()
  expect(mocks.refresh).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
})
it('ignores a request that completes after unmount', async () => {
  let finish: (value: RunStatusDTO) => void = () => {
    throw new Error('Not started')
  }
  mocks.poll.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const view = render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  view.unmount()
  await act(async () => {
    finish(run('succeeded'))
  })
  expect(mocks.refresh).not.toHaveBeenCalled()
})

it('refreshes a run that starts and finishes between idle polls', async () => {
  mocks.poll.mockResolvedValueOnce(null).mockResolvedValue(run('succeeded'))
  render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(mocks.refresh).not.toHaveBeenCalled()
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(30000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
})

it('refreshes a different completed run without requiring an active observation', async () => {
  mocks.poll.mockResolvedValueOnce(run('succeeded')).mockResolvedValue({
    ...run('succeeded'),
    runId: 'next-run',
  })
  render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  mocks.refresh.mockClear()
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(15000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
})

it('refreshes once when a run completed before the first poll', async () => {
  mocks.poll.mockResolvedValue(run('succeeded'))
  render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(30000))
  expect(mocks.refresh).toHaveBeenCalledTimes(1)
})

const failedRun = (): RunStatusDTO => ({
  ...run('failed'),
  failures: [{ articleId: 9, keyword: 'broken piece', stage: 'generate', message: 'boom' }],
})

describe('queue announcements', () => {
  it('polls immediately instead of waiting out the idle delay', async () => {
    mocks.poll.mockResolvedValue(null)
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(mocks.poll).toHaveBeenCalledTimes(1)
    await act(async () => announceRunQueued({ runId: 'next-run' }))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(mocks.poll).toHaveBeenCalledTimes(2)
  })

  it('does not show a run that finished before the action as its result', async () => {
    const old = { ...run('succeeded'), runId: 'old-run' }
    mocks.poll.mockResolvedValue(old)
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Run finished')).toBeTruthy()

    await act(async () => announceRunQueued({ runId: 'new-run' }))
    // Immediately, before any poll has answered: the old result is gone.
    expect(screen.queryByText('Run finished')).toBeNull()
    expect(screen.getByText('Queued — waiting to start')).toBeTruthy()

    // A poll that still returns the old run does not bring it back.
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.queryByText('Run finished')).toBeNull()
    expect(screen.getByText('Queued — waiting to start')).toBeTruthy()

    mocks.poll.mockResolvedValue({ ...run('running'), runId: 'new-run' })
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(screen.getByText(/test article/)).toBeTruthy()
  })

  it('drops the placeholder when no run ever appears', async () => {
    mocks.poll.mockResolvedValue(null)
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    await act(async () => announceRunQueued())
    expect(screen.getByText('Queued — waiting to start')).toBeTruthy()
    await act(() => vi.advanceTimersByTimeAsync(21000))
    expect(screen.queryByText('Queued — waiting to start')).toBeNull()
  })

  it('tells runs apart by creation time when the action carried no id', () => {
    const at = Date.parse('2026-01-01T00:00:10Z')
    const detail = { queuedAt: at }
    expect(isStaleRun({ runId: 'a', createdAtIso: '2026-01-01T00:00:00Z' }, detail)).toBe(true)
    expect(isStaleRun({ runId: 'b', createdAtIso: '2026-01-01T00:00:09Z' }, detail)).toBe(false)
    expect(isStaleRun({ runId: 'b', createdAtIso: '2026-01-01T00:00:11Z' }, detail)).toBe(false)
  })
})

describe('announcements and failures', () => {
  it('keeps the elapsed clock out of every live region', async () => {
    mocks.poll.mockResolvedValue(run('running'))
    const { container } = render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(container.querySelector('.datum-runbar')?.getAttribute('role')).toBeNull()
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Run in progress: Running QA checks')
    const detail = container.querySelector('.datum-runbar__detail')?.textContent
    expect(detail).toMatch(/elapsed/)
    expect(status.contains(container.querySelector('.datum-runbar__detail'))).toBe(false)

    await act(() => vi.advanceTimersByTimeAsync(2000))
    expect(screen.getByRole('status').textContent).toBe('Run in progress: Running QA checks')
    expect(container.querySelector('.datum-runbar__detail')?.textContent).not.toBe(detail)
  })

  it('announces a finished run once and a failure as an alert', async () => {
    mocks.poll.mockResolvedValueOnce(run('queued')).mockResolvedValueOnce(failedRun())
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByRole('status').textContent).toBe('Run queued')
    expect(screen.getByRole('alert').textContent).toBe('')
    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByRole('alert').textContent).toBe(
      'Run failed. broken piece failed at generate',
    )
  })

  it('keeps a failed run on screen past the success linger until dismissed', async () => {
    mocks.poll.mockResolvedValue(failedRun())
    const first = render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    await act(() => vi.advanceTimersByTimeAsync(31000))
    expect(screen.getByText('Run failed')).toBeTruthy()

    await act(async () => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByText('Run failed')).toBeNull()
    expect(window.localStorage.getItem('datum.runbar.dismissed')).toBe('test-run')

    // The dismissal survives a reload.
    first.unmount()
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.queryByText('Run failed')).toBeNull()
  })

  it('still lets a successful run time out', async () => {
    mocks.poll.mockResolvedValue(run('succeeded'))
    render(React.createElement(GlobalRunBar))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.getByText('Run finished')).toBeTruthy()
    await act(() => vi.advanceTimersByTimeAsync(31000))
    expect(screen.queryByText('Run finished')).toBeNull()
    expect(within(document.body).getByRole('status').textContent).toBe('')
  })
})

it('numbers the step out of the five content stages the piece stepper shows', async () => {
  mocks.poll.mockResolvedValue({
    ...run('running'),
    articles: [{ id: 1, keyword: 'test article', status: 'researched' }],
  })
  render(React.createElement(GlobalRunBar))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText('Step 3 of 5 · Writing the draft · test article')).toBeTruthy()
})
