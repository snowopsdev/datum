import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same harness as articleActions.int.spec: no Next request scope, no Payload boot.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'editor@example.com' } }))
const findByIDMock = vi.fn(async (_args: unknown) => ({}) as never)
const updateMock = vi.fn(async (_args: unknown) => ({}) as never)
const createRunMock = vi.fn(async (_payload: unknown, _user: unknown, _input: unknown) => undefined)
const setupMock = vi.fn(async () => ({
  readiness: {
    mode: 'mock',
    runtime: { ready: true, missing: [] },
    governance: { ready: true, activeVoiceId: 1 },
    content: { ready: true, templateCount: 3, models: [] },
    configFingerprint: 'x',
  },
  templates: [],
  latestRun: null,
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({ auth: authMock, findByID: findByIDMock, update: updateMock })),
  }
})
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createRunMock }
})
vi.mock('@/lib/loadWorkspaceReadiness', () => ({ loadWorkspaceSetup: setupMock }))

const { approveBriefAction, revisitBriefAction, saveBriefAction } = await import(
  '@/components/ops/briefActions'
)

const atBrief = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    status: 'brief_review',
    template: 3,
    brief: { angle: 'old', sections: [{ heading: 'A', source: 'template' }], notes: '' },
    ...over,
  }) as never

const edits = {
  angle: '  New angle ',
  audience: 'People',
  sections: [
    { heading: 'A', notes: 'say this', source: 'template' as const },
    { heading: '  ', notes: 'dropped: blank heading', source: 'editor' as const },
  ],
  notes: 'Lead with the routine.',
}

beforeEach(() => {
  findByIDMock.mockReset()
  updateMock.mockReset()
  createRunMock.mockReset()
})

describe('saveBriefAction', () => {
  it('trims, drops blank sections, and writes the brief without changing status', async () => {
    findByIDMock.mockResolvedValue(atBrief())
    const result = await saveBriefAction(1, edits)
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as { data: { brief: Record<string, unknown>; status?: string } }
    expect(call.data.status).toBeUndefined()
    expect(call.data.brief.angle).toBe('New angle')
    expect(call.data.brief.sections).toEqual([{ heading: 'A', notes: 'say this', source: 'template' }])
    expect(call.data.brief.notes).toBe('Lead with the routine.')
  })

  it('refuses once the brief has been approved', async () => {
    findByIDMock.mockResolvedValue(atBrief({ status: 'researched' }))
    const result = await saveBriefAction(1, edits)
    expect(result.ok).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('approveBriefAction', () => {
  it('moves the piece to researched, stamps the approval, and queues a run for it', async () => {
    findByIDMock.mockResolvedValue(atBrief())
    const result = await approveBriefAction(1, edits)
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { status: string; brief: { approvedAt?: string; approvedBy?: string; angle?: string } }
      context: { articleAudit: { event: string } }
    }
    expect(call.data.status).toBe('researched')
    expect(call.data.brief.approvedBy).toBe('editor@example.com')
    expect(call.data.brief.approvedAt).toMatch(/^\d{4}-/)
    // Edits handed in with the approval are kept, not thrown away.
    expect(call.data.brief.angle).toBe('New angle')
    expect(call.context.articleAudit.event).toBe('brief_approved')

    expect(createRunMock).toHaveBeenCalledTimes(1)
    const runInput = createRunMock.mock.calls[0]?.[2] as unknown as { source: string; articleIds: number[] }
    expect(runInput.source).toBe('selected')
    expect(runInput.articleIds).toEqual([1])
  })

  it('refuses without a template, before touching anything', async () => {
    findByIDMock.mockResolvedValue(atBrief({ template: null }))
    const result = await approveBriefAction(1)
    expect(result.ok).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
    expect(createRunMock).not.toHaveBeenCalled()
  })

  it('refuses when the brief is not waiting', async () => {
    findByIDMock.mockResolvedValue(atBrief({ status: 'drafted' }))
    expect((await approveBriefAction(1)).ok).toBe(false)
    expect(createRunMock).not.toHaveBeenCalled()
  })
})

describe('revisitBriefAction', () => {
  it('sends a draft back to its brief and clears the approval', async () => {
    findByIDMock.mockResolvedValue(atBrief({ status: 'needs_revision', brief: { approvedAt: 'x', approvedBy: 'y' } }))
    const result = await revisitBriefAction(1)
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as { data: { status: string; brief: { approvedAt: null } } }
    expect(call.data.status).toBe('brief_review')
    expect(call.data.brief.approvedAt).toBeNull()
  })

  it('will not reopen a published piece, nor one research has not reached', async () => {
    findByIDMock.mockResolvedValue(atBrief({ status: 'published' }))
    expect((await revisitBriefAction(1)).ok).toBe(false)
    findByIDMock.mockResolvedValue(atBrief({ status: 'topic_selected' }))
    expect((await revisitBriefAction(1)).ok).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
  })
})
