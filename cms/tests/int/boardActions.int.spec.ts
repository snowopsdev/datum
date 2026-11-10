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
const updateMock = vi.fn(async (_args: { id?: number; data?: Record<string, unknown> }) => ({}) as never)

const { createPipelineRunMock, loadWorkspaceSetupMock, loadReportCostsMock } = vi.hoisted(() => ({
  createPipelineRunMock: vi.fn(),
  loadWorkspaceSetupMock: vi.fn(),
  loadReportCostsMock: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/loadWorkspaceReadiness', () => ({
  loadWorkspaceSetup: loadWorkspaceSetupMock,
  loadActiveAudienceOptions: vi.fn(async () => []),
}))
// The run bar's totals are one SQL aggregate (covered against a database in
// `adminPerformance.int.spec.ts`); here it only has to be asked, and trusted.
vi.mock('@/lib/reportQueries', () => ({ loadReportCosts: loadReportCostsMock }))
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createPipelineRunMock }
})
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    createLocalReq: vi.fn(async () => ({ stand: 'in' })),
    getPayload: vi.fn(async () => ({ auth: authMock, find: findMock, update: updateMock })),
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
const { latestRunAction, removeTopicsAction, runSelectedArticlesAction } = await import(
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
    expect(result).toEqual({
      ok: true,
      message: expect.stringContaining('1 article'),
      runId: expect.any(String),
    })
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ source: 'selected', articleIds: [1], templateId: 3 }),
    )
  })

  it('reads only the article fields the queue helper checks', async () => {
    await runSelectedArticlesAction({ articleIds: [1] })
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'articles',
        select: { status: true, archived: true, template: true },
      }),
    )
  })

  it('tells a signed-out caller to sign in, in the content list’s words', async () => {
    authMock.mockResolvedValueOnce({ user: null } as never)
    expect(await runSelectedArticlesAction({ articleIds: [1] })).toEqual({
      ok: false,
      error: 'Sign in to manage the content list.',
    })
  })

  it('passes a refusal from the queue helper through its own generic catch', async () => {
    // The helper throws; the action's `errorMessage(error, 'Could not start
    // that run.')` branch is what turns that into the sentence the board shows,
    // and it must keep the helper's words rather than the fallback.
    findMock.mockResolvedValueOnce({ docs: [] } as never)
    expect(await runSelectedArticlesAction({ articleIds: [1] })).toEqual({
      ok: false,
      error: 'Those articles no longer exist.',
    })
    expect(createPipelineRunMock).not.toHaveBeenCalled()
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
  // The run bar polls this from every admin route, the login page included.
  it('answers null for a signed-out caller and reads nothing', async () => {
    vi.clearAllMocks()
    authMock.mockResolvedValueOnce({ user: null } as never)
    expect(await latestRunAction()).toBeNull()
    expect(findMock).not.toHaveBeenCalled()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
  })

  /** A run row as the action selects it. */
  const row = (runId: string, status: string, createdAt: string, extra = {}) => ({
    runId,
    status,
    mode: 'mock',
    source: 'selected',
    createdAt,
    startedAt: status === 'queued' ? null : createdAt,
    completedAt: null,
    articles: [],
    ...extra,
  })

  /** Answers the run reads: the active query and the newest-settled query differ by `where`. */
  const withRuns = (active: unknown[], settled: unknown[] = []) =>
    findMock.mockImplementation(async (args: { collection?: string; where?: unknown }) => {
      if (args.collection === 'pipeline-runs') {
        return { docs: args.where ? active : settled } as never
      }
      return { docs: [] } as never
    })

  it('follows the running run, not the newest queued one behind it', async () => {
    withRuns([
      row('run-a', 'running', '2026-01-01T00:00:00Z'),
      row('run-b', 'queued', '2026-01-01T00:01:00Z'),
      row('run-c', 'queued', '2026-01-01T00:02:00Z'),
    ])
    const result = await latestRunAction()
    expect(result).toMatchObject({
      runId: 'run-a',
      status: 'running',
      activeRunIds: ['run-a', 'run-b', 'run-c'],
    })
  })

  it('follows the oldest queued run when none is running yet', async () => {
    withRuns([
      row('run-b', 'queued', '2026-01-01T00:01:00Z'),
      row('run-c', 'queued', '2026-01-01T00:02:00Z'),
    ])
    expect(await latestRunAction()).toMatchObject({
      runId: 'run-b',
      activeRunIds: ['run-b', 'run-c'],
    })
    // Oldest first is the database's job; the action has to ask for it.
    const activeQuery = findMock.mock.calls.find(
      ([args]) => (args as { where?: unknown }).where,
    )?.[0] as { sort?: string; limit?: number }
    expect(activeQuery.sort).toBe('createdAt')
  })

  it('falls back to the newest settled run when nothing is active', async () => {
    withRuns([], [row('run-z', 'failed', '2026-01-01T00:00:00Z', { warnings: [] })])
    expect(await latestRunAction()).toMatchObject({
      runId: 'run-z',
      status: 'failed',
      activity: null,
      activeRunIds: [],
    })
    expect(loadReportCostsMock).not.toHaveBeenCalled()
  })

  it('answers null when there has never been a run', async () => {
    withRuns([], [])
    expect(await latestRunAction()).toBeNull()
  })

  // Totals used to be summed from the newest 500 cost-log rows, so a long run's
  // call count and cost stopped rising at 500.
  it('takes totals from the aggregate and reads one cost row for the last call', async () => {
    withRuns([row('run-a', 'running', '2026-01-01T00:00:00Z')])
    loadReportCostsMock.mockResolvedValue({
      aggregate: { rowCount: 1200, totalUsd: 12.5, byStage: [], byModel: [] },
      stages: [
        { stage: 'generate', calls: 1000, costUsd: 10, inputTokens: 0, outputTokens: 0 },
        { stage: 'factCheck', calls: 200, costUsd: 2.5, inputTokens: 0, outputTokens: 0 },
      ],
    })
    const costFind = vi.fn()
    findMock.mockImplementation(async (args: { collection?: string; where?: unknown }) => {
      if (args.collection === 'pipeline-runs') {
        return { docs: [row('run-a', 'running', '2026-01-01T00:00:00Z')] } as never
      }
      if (args.collection === 'cost-log') {
        costFind(args)
        return { docs: [{ stage: 'factCheck', createdAt: '2026-01-01T00:05:00Z' }] } as never
      }
      return { docs: [] } as never
    })
    const result = await latestRunAction()
    expect(loadReportCostsMock).toHaveBeenCalledWith(expect.anything(), { pipelineRunId: 'run-a' })
    expect(result?.activity).toEqual({
      totalCalls: 1200,
      totalCostUsd: 12.5,
      byStage: [
        { stage: 'generate', calls: 1000, costUsd: 10 },
        { stage: 'factCheck', calls: 200, costUsd: 2.5 },
      ],
      lastCallStage: 'factCheck',
      lastCallAtIso: '2026-01-01T00:05:00.000Z',
    })
    expect(costFind).toHaveBeenCalledTimes(1)
    expect(costFind.mock.calls[0][0]).toMatchObject({ limit: 1, sort: '-createdAt' })
  })

  it('says what actually went wrong instead of a fixed sentence', async () => {
    findMock.mockRejectedValueOnce(new Error('connection terminated unexpectedly'))
    await expect(latestRunAction()).rejects.toThrow(
      'Could not load run status: connection terminated unexpectedly',
    )
  })
})

describe('removeTopicsAction', () => {
  const topic = { id: 1, status: 'topic_selected', keyword: 'espresso grinders' }

  /** `articles` returns the topic; `pipeline-runs` returns whatever is active. */
  const withActiveRuns = (runs: { runId: string }[]) =>
    findMock.mockImplementation(
      async (args: { collection?: string }) =>
        ({ docs: args.collection === 'pipeline-runs' ? runs : [topic] }) as never,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
  })

  it('archives a topic no run is carrying', async () => {
    withActiveRuns([])
    const message = await removeTopicsAction([1])
    expect(message).toMatchObject({ ok: true, message: expect.stringContaining('from the content list.') })
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'articles', select: { status: true, keyword: true } }),
    )
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } } as never)
    withActiveRuns([])
    expect(await removeTopicsAction([1])).toMatchObject({ ok: true })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, data: { archived: true }, overrideAccess: false }),
    )
  })

  // An archived article refuses every status change, so removing a topic while
  // research is running throws that research away after it has been paid for.
  // `archiveArticleAction` refuses the same thing on the article page.
  it('refuses a topic an active run is carrying', async () => {
    withActiveRuns([{ runId: 'run-9' }])
    expect(await removeTopicsAction([1])).toEqual({
      ok: false,
      error: 'This topic is in an active run. Wait for the run to finish before removing it.',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
