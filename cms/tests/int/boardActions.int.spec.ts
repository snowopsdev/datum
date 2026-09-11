import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceReadiness } from '@/lib/workspaceReadiness'

// The board actions are exercised outside a Next.js request scope and without a
// database: `payload` keeps its real exports (importOriginal) and only
// `getPayload` is replaced, the workspace checklist is stubbed because it reads
// eight collections and globals, and `createPipelineRun` — reached through
// `queueRunForArticles`, whose own behaviour is covered in
// `queueRunForArticles.int.spec.ts` — is stubbed because it opens a Postgres
// transaction and takes an advisory lock. Its `ActivePipelineRunError` stays
// real: `runSelectedArticlesAction` branches on `instanceof`.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'reviewer@example.com' } }))
const findMock = vi.fn(async (_args: { collection?: string }) => ({ docs: [] }) as never)

const { createPipelineRunMock, loadWorkspaceSetupMock } = vi.hoisted(() => ({
  createPipelineRunMock: vi.fn(),
  loadWorkspaceSetupMock: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/loadWorkspaceReadiness', () => ({
  loadWorkspaceSetup: loadWorkspaceSetupMock,
  loadActiveAudienceOptions: vi.fn(async () => []),
}))
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createPipelineRunMock }
})
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ auth: authMock, find: findMock })),
  }
})

/** Enough of `WorkspaceReadiness` for the run gate; nothing else reads it. */
const readyReadiness = (overrides: Record<string, unknown> = {}) =>
  ({
    mode: 'mock',
    runtime: { ready: true, missing: [], blockers: [] },
    governance: { ready: true, activeVoiceId: 1, problems: [] },
    ...overrides,
  }) as unknown as WorkspaceReadiness

const readySetup = (overrides: Record<string, unknown> = {}) =>
  ({
    readiness: readyReadiness(overrides),
    templates: [{ id: 3, name: 'Guide' }],
    icps: [],
    latestRun: null,
  }) as never

const { ActivePipelineRunError } = await import('@/lib/createPipelineRun')
const { latestRunAction, runSelectedArticlesAction } = await import(
  '@/components/ops/boardActions'
)

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
  findMock.mockResolvedValue({ docs: [{ id: 1, status: 'drafted', template: 3 }] } as never)
  loadWorkspaceSetupMock.mockResolvedValue(readySetup())
  createPipelineRunMock.mockResolvedValue(undefined)
})

describe('runSelectedArticlesAction', () => {
  it('names every governance problem instead of assuming brand voice', async () => {
    // Governance has been three assets since the tenant work landed. Naming
    // only the brand voice sends an operator who has one to look for a problem
    // that is not there.
    loadWorkspaceSetupMock.mockResolvedValueOnce(
      readySetup({
        governance: {
          ready: false,
          activeVoiceId: 1,
          problems: ['Add an active audience', 'Set a target domain'],
        },
      }),
    )
    const result = await runSelectedArticlesAction({ articleIds: [1] })
    expect(result).toEqual({
      ok: false,
      error: 'Finish setup before running the pipeline: Add an active audience; Set a target domain.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('queues a selected run for the ticked articles', async () => {
    const result = await runSelectedArticlesAction({ articleIds: [1] })
    expect(result).toEqual({ ok: true, message: expect.stringContaining('1 article') })
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1], templateId: 3 }),
    )
  })

  it('reports an active run rather than silently dropping the request', async () => {
    createPipelineRunMock.mockRejectedValueOnce(new ActivePipelineRunError('run-42'))
    expect(await runSelectedArticlesAction({ articleIds: [1] })).toEqual({
      ok: false,
      error: 'Run run-42 is already in progress. Wait for it to finish before starting another.',
    })
  })
})

describe('latestRunAction', () => {
  it('says what actually went wrong instead of a fixed sentence', async () => {
    findMock.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    await expect(latestRunAction()).rejects.toThrow(
      'Could not load run status: connection terminated unexpectedly',
    )
  })
})
