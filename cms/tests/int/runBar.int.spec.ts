import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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
const run = (status: RunStatusDTO['status']): RunStatusDTO => ({
  runId: 'test-run',
  status,
  mode: 'mock',
  source: 'selected',
  startedLabel: 'now',
  startedAtIso: new Date().toISOString(),
  completedAtIso: status === 'succeeded' ? new Date().toISOString() : null,
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
