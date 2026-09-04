import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startRunPolling } from '@/components/ops/runPolling'

let hidden = false
const listeners = new Set<EventListenerOrEventListenerObject>()
const visibility = {
  get hidden() {
    return hidden
  },
  addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    listeners.add(listener)
  },
  removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
    listeners.delete(listener)
  },
}
function changeVisibility(value: boolean) {
  hidden = value
  for (const listener of listeners) {
    if (typeof listener === 'function') listener(new Event('visibilitychange'))
  }
}
beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  listeners.clear()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('run polling', () => {
  it('waits for slow requests, then uses the active cadence', async () => {
    let finish: (active: boolean) => void = () => {
      throw new Error('Not started')
    }
    const poll = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    const stop = startRunPolling({ poll, visibility })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10000)
    expect(poll).toHaveBeenCalledTimes(1)
    finish(true)
    await vi.advanceTimersByTimeAsync(2999)
    expect(poll).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(poll).toHaveBeenCalledTimes(2)
    stop()
    finish(false)
    await vi.advanceTimersByTimeAsync(30000)
    expect(poll).toHaveBeenCalledTimes(2)
  })
  it('pauses when hidden, resumes immediately, and cleans up', async () => {
    const poll = vi.fn(async () => false)
    const stop = startRunPolling({ poll, visibility })
    await vi.advanceTimersByTimeAsync(0)
    changeVisibility(true)
    await vi.advanceTimersByTimeAsync(45000)
    expect(poll).toHaveBeenCalledTimes(1)
    changeVisibility(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(poll).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(15000)
    expect(poll).toHaveBeenCalledTimes(3)
    stop()
    expect(listeners.size).toBe(0)
  })
  it('recovers from a failed request without overlapping or stopping', async () => {
    const poll = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(true)
    const stop = startRunPolling({ poll, visibility })
    await vi.advanceTimersByTimeAsync(6000)
    expect(poll).toHaveBeenCalledTimes(3)
    stop()
  })
})
