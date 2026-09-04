import { expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ auth: vi.fn(async () => ({ user: null })), read: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('payload', () => ({ getPayload: async () => ({ auth: mocks.auth }) }))
vi.mock('@/lib/readAuditDetails', () => ({ readAuditDetails: mocks.read }))
const { auditDetailsAction } = await import('@/components/ops/auditActions')
it('rejects anonymous callers before reading article or event data', async () => {
  expect(await auditDetailsAction({ articleId: 1, kind: 'cost', recordId: 1 })).toEqual({
    ok: false,
    error: 'Sign in to read evidence.',
  })
  expect(mocks.read).not.toHaveBeenCalled()
})
