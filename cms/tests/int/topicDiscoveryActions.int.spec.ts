import { beforeEach, expect, it, vi } from 'vitest'

/**
 * Creating a topic queues its research through the one run gate.
 *
 * The action used to ask its own `runtime.ready && governance.ready` question
 * and skip research silently when the answer was no — so a live workspace
 * researched a piece nobody had agreed to pay for, and an unready one left the
 * panel saying "research will start once the workspace is ready" without ever
 * naming what was missing. The gate answers both now, and the refusal comes
 * back with the article so the panel can print it.
 *
 * No database and no Next request scope: the same harness `briefActions`
 * uses.
 */
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'editor@example.com' } }))
const findMock = vi.fn(async (_args: unknown) => ({ docs: [] }) as never)
const CREATED = { id: 42, status: 'topic_selected', template: 3, keyword: 'espresso descaling' }
const createMock = vi.fn(async (_args: unknown) => CREATED as never)
const createRunMock = vi.fn(async (_payload: unknown, _user: unknown, _input: unknown) => undefined)

let readiness: Record<string, unknown>
const freshReadiness = () => ({
  mode: 'mock',
  runtime: { ready: true, missing: [], problems: [], blockers: [] },
  governance: { ready: true, activeVoiceId: 1, problems: [], blockers: [] },
  content: { ready: true, templateCount: 3, models: [] },
  configFingerprint: 'x',
})

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ auth: authMock, find: findMock, create: createMock })),
  }
})
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createRunMock }
})
vi.mock('@/lib/loadWorkspaceReadiness', () => ({
  loadWorkspaceSetup: vi.fn(async () => ({
    readiness,
    templates: [],
    icps: [{ id: 11, name: 'Marketing lead', primary: true, audienceLine: 'A marketing lead.' }],
    latestRun: null,
  })),
}))

const { createTopicsAction } = await import('@/components/ops/topicDiscoveryActions')

beforeEach(() => {
  readiness = freshReadiness()
  findMock.mockReset()
  findMock.mockResolvedValue({ docs: [] } as never)
  createMock.mockReset()
  createMock.mockResolvedValue(CREATED as never)
  createRunMock.mockReset()
})

it('creates the piece and queues research when the workspace is ready', async () => {
  const result = await createTopicsAction({ keywords: ['espresso descaling'], templateId: 3 })
  expect(result).toMatchObject({ ok: true, articleId: 42, researchQueued: true })
  expect(result.ok && result.researchBlockedReason).toBe(null)
  expect(createRunMock).toHaveBeenCalledTimes(1)
})

it('still creates the piece in live mode, and hands back why research did not start', async () => {
  readiness = { ...freshReadiness(), mode: 'live' }
  const result = await createTopicsAction({ keywords: ['espresso descaling'], templateId: 3 })
  expect(result).toMatchObject({
    ok: true,
    articleId: 42,
    researchQueued: false,
    researchBlockedReason: 'Confirm the live provider cost before starting this run.',
  })
  expect(createMock).toHaveBeenCalledTimes(1)
  expect(createRunMock).not.toHaveBeenCalled()
})

it('queues in live mode once the cost is confirmed', async () => {
  readiness = { ...freshReadiness(), mode: 'live' }
  const result = await createTopicsAction({
    keywords: ['espresso descaling'],
    templateId: 3,
    confirmLiveCost: true,
  })
  expect(result).toMatchObject({ ok: true, researchQueued: true, researchBlockedReason: null })
  expect(createRunMock).toHaveBeenCalledTimes(1)
})

it('names the missing governance asset rather than staying silent', async () => {
  readiness = {
    ...freshReadiness(),
    governance: {
      ready: false,
      activeVoiceId: null,
      problems: ['Activate a brand voice'],
      blockers: [],
    },
  }
  const result = await createTopicsAction({ keywords: ['espresso descaling'], templateId: 3 })
  expect(result).toMatchObject({
    ok: true,
    researchQueued: false,
    researchBlockedReason: 'Finish setup before running the pipeline: Activate a brand voice.',
  })
})
