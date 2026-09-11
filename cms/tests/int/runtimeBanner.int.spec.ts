import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * The banner is for whoever deploys this, and a missing key is not a notice
 * you read once: dismissing it hid the only sign that every run would fail.
 * Prose blockers (a model no provider serves) stay dismissible.
 */
const mocks = vi.hoisted(() => ({
  status: vi.fn<
    () => Promise<{ mode: 'mock' | 'live'; missing: string[]; problems: string[] }>
  >(),
}))
vi.mock('@/components/ops/tenantActions', () => ({ runtimeStatusAction: mocks.status }))

const { RuntimeBanner } = await import('@/components/ops/RuntimeBanner')

const show = async () => {
  vi.useFakeTimers()
  render(React.createElement(RuntimeBanner))
  await act(async () => {
    vi.runAllTimers()
    await Promise.resolve()
  })
  vi.useRealTimers()
}

beforeEach(() => mocks.status.mockReset())
afterEach(cleanup)

it('names the variables, points at cms/.env, and cannot be dismissed', async () => {
  mocks.status.mockResolvedValue({
    mode: 'live',
    missing: ['AHREFS_API_KEY', 'ANTHROPIC_API_KEY'],
    problems: [],
  })

  await show()

  expect(screen.getByRole('status').textContent).toBe(
    'Live providers are not configured. Runs will fail until AHREFS_API_KEY, ANTHROPIC_API_KEY are set in cms/.env.',
  )
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
})

it('still lets a prose blocker be dismissed, and says nothing in mock mode', async () => {
  mocks.status.mockResolvedValue({
    mode: 'live',
    missing: [],
    problems: ['Select an API-backed model instead of codex/gpt-5.6-terra'],
  })

  await show()

  expect(screen.getByRole('status').textContent).toContain(
    'Select an API-backed model instead of codex/gpt-5.6-terra',
  )
  const dismiss = screen.getByRole('button', { name: 'Dismiss' })
  await act(async () => {
    dismiss.click()
  })
  expect(screen.queryByRole('status')).toBeNull()

  cleanup()
  mocks.status.mockResolvedValue({ mode: 'mock', missing: ['AHREFS_API_KEY'], problems: [] })
  await show()
  expect(screen.queryByRole('status')).toBeNull()
})
