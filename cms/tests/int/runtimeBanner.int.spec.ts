// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

/**
 * The banner is for whoever deploys this, and in live mode everything it can
 * say is fatal: the run fails until somebody fixes it. None of it is a notice
 * you read once, so none of it can be dismissed.
 */
const mocks = vi.hoisted(() => ({
  status: vi.fn<
    () => Promise<{
      mode: 'mock' | 'live'
      ready: boolean
      missing: string[]
      problems: string[]
    }>
  >(),
}))
vi.mock('@/components/ops/tenantActions', () => ({ runtimeStatusAction: mocks.status }))
// The provider is mounted on the login page too, where there is no user.
const auth = vi.hoisted(() => ({ user: null as { id: number } | null }))
vi.mock('@payloadcms/ui', () => ({ useAuth: () => ({ user: auth.user }) }))

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

beforeEach(() => {
  mocks.status.mockReset()
  auth.user = { id: 1 }
})
afterEach(cleanup)

it('names the variables, points at cms/.env, and cannot be dismissed', async () => {
  mocks.status.mockResolvedValue({
    mode: 'live',
    ready: false,
    missing: ['AHREFS_API_KEY', 'ANTHROPIC_API_KEY'],
    problems: [],
  })

  await show()

  expect(screen.getByRole('status').textContent).toBe(
    'Live providers are not configured. Runs will fail until AHREFS_API_KEY, ANTHROPIC_API_KEY are set in cms/.env.',
  )
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
})

it('cannot be dismissed for a placeholder .env either, where every key is set', async () => {
  mocks.status.mockResolvedValue({
    mode: 'live',
    ready: false,
    missing: [],
    problems: [
      'Replace the .env.example placeholders in TARGET_DOMAIN, COMPETITOR_DOMAINS, or fill in the Workspace step (what is saved there is used instead)',
    ],
  })

  await show()

  const banner = screen.getByRole('status')
  expect(banner.textContent).toContain('Replace the .env.example placeholders')
  // Runs fail on a placeholder domain exactly as they fail on a missing key,
  // so this one is no more dismissible than that one.
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
})

it('cannot be dismissed for a model no provider serves', async () => {
  mocks.status.mockResolvedValue({
    mode: 'live',
    ready: false,
    missing: [],
    problems: ['Select an API-backed model instead of codex/gpt-5.6-terra'],
  })

  await show()

  expect(screen.getByRole('status').textContent).toContain(
    'Select an API-backed model instead of codex/gpt-5.6-terra',
  )
  expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
})

it('says nothing in mock mode, or when a live workspace is ready', async () => {
  mocks.status.mockResolvedValue({
    mode: 'mock',
    ready: false,
    missing: ['AHREFS_API_KEY'],
    problems: [],
  })
  await show()
  expect(screen.queryByRole('status')).toBeNull()

  cleanup()
  mocks.status.mockResolvedValue({ mode: 'live', ready: true, missing: [], problems: [] })
  await show()
  expect(screen.queryByRole('status')).toBeNull()
})

const liveBroken = {
  mode: 'live' as const,
  ready: false,
  missing: ['AHREFS_API_KEY'],
  problems: [],
}

it('does not ask while nobody is signed in, and asks once they are', async () => {
  mocks.status.mockResolvedValue(liveBroken)
  auth.user = null
  vi.useFakeTimers()
  const view = render(React.createElement(RuntimeBanner))
  await act(async () => {
    vi.runAllTimers()
    await Promise.resolve()
  })
  expect(mocks.status).not.toHaveBeenCalled()
  expect(screen.queryByRole('status')).toBeNull()

  // Payload's login navigates client-side: the same mounted banner now has a user.
  auth.user = { id: 1 }
  view.rerender(React.createElement(RuntimeBanner))
  await act(async () => {
    vi.runAllTimers()
    await Promise.resolve()
  })
  vi.useRealTimers()
  expect(mocks.status).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status').textContent).toContain('AHREFS_API_KEY')
})

it('asks again for a different user and hides the banner after sign-out', async () => {
  mocks.status.mockResolvedValue(liveBroken)
  vi.useFakeTimers()
  const view = render(React.createElement(RuntimeBanner))
  const flush = () =>
    act(async () => {
      vi.runAllTimers()
      await Promise.resolve()
    })
  await flush()
  auth.user = { id: 2 }
  view.rerender(React.createElement(RuntimeBanner))
  await flush()
  expect(mocks.status).toHaveBeenCalledTimes(2)

  auth.user = null
  view.rerender(React.createElement(RuntimeBanner))
  await flush()
  vi.useRealTimers()
  expect(mocks.status).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole('status')).toBeNull()
})
