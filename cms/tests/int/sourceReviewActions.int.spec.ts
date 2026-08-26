import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mocked so the actions can run outside a real Next.js request scope and a real
// Payload instance. `payload` keeps its real exports (importOriginal) so
// anything importing APIError from it still resolves.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'reviewer@example.com' } }))
const findByIDMock = vi.fn(
  async () =>
    ({ id: 1, domain: 'cited.test', citationCount: 4, serpCount: 1, status: 'pending' }) as never,
)
const findMock = vi.fn(async (_args: { collection?: string }) => ({ docs: [] }) as never)
// Typed args, so `mock.calls[n][0]` is inspectable rather than an empty tuple.
const createMock = vi.fn(async (_args: Record<string, unknown>) => ({ id: 99 }) as never)
const updateMock = vi.fn(async (_args: Record<string, unknown>) => ({ id: 99 }) as never)

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({
      auth: authMock,
      findByID: findByIDMock,
      find: findMock,
      create: createMock,
      update: updateMock,
    })),
  }
})

const { approveCandidateAction, dismissCandidateAction, reopenCandidateAction } = await import(
  '@/components/ops/sourceReviewActions'
)

const rules = (docs: Record<string, unknown>[]) => {
  findMock.mockImplementation(async () => ({ docs }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 7, email: 'reviewer@example.com' } })
  findByIDMock.mockResolvedValue({
    id: 1,
    domain: 'cited.test',
    citationCount: 4,
    serpCount: 1,
    status: 'pending',
  } as never)
  createMock.mockResolvedValue({ id: 99 } as never)
  updateMock.mockResolvedValue({ id: 99 } as never)
  rules([])
})

describe('approveCandidateAction', () => {
  it('creates the rule and marks the candidate approved', async () => {
    const result = await approveCandidateAction({
      candidateId: 1,
      qualityClass: 'primary',
      note: 'Publishes its own data.',
    })

    expect(result).toEqual({ ok: true })
    const created = createMock.mock.calls[0]?.[0] as unknown as {
      collection: string
      data: Record<string, unknown>
    }
    expect(created.collection).toBe('evidence-sources')
    expect(created.data).toMatchObject({
      domain: 'cited.test',
      qualityClass: 'primary',
      note: 'Publishes its own data.',
      active: true,
    })

    const candidateUpdate = updateMock.mock.calls.at(-1)?.[0] as unknown as {
      collection: string
      data: Record<string, unknown>
      overrideAccess?: boolean
    }
    expect(candidateUpdate.collection).toBe('evidence-source-candidates')
    expect(candidateUpdate.data).toMatchObject({ status: 'approved', resolvedSource: 99 })
    expect(candidateUpdate.data.resolvedBy).toBe('reviewer@example.com')
    // The collection refuses API writes, so only overrideAccess gets through.
    expect(candidateUpdate.overrideAccess).toBe(true)
  })

  // The audit row comes from the evidence-sources afterChange hook; the context
  // is the only thing tying it back to the queue this decision came from.
  it('names the event and the candidate for the audit hook', async () => {
    await approveCandidateAction({ candidateId: 1, qualityClass: 'official_docs' })
    const created = createMock.mock.calls[0]?.[0] as unknown as {
      context: { governanceAudit: { event: string; actor: string; details: Record<string, unknown> } }
    }
    expect(created.context.governanceAudit.event).toBe('evidence_source_approved')
    expect(created.context.governanceAudit.actor).toBe('reviewer@example.com')
    expect(created.context.governanceAudit.details).toMatchObject({
      domain: 'cited.test',
      qualityClass: 'official_docs',
      candidateId: 1,
      citationCount: 4,
    })
  })

  it('normalises the domain before writing the rule', async () => {
    findByIDMock.mockResolvedValue({ id: 1, domain: 'WWW.Cited.test' } as never)
    await approveCandidateAction({ candidateId: 1, qualityClass: 'secondary' })
    const created = createMock.mock.calls[0]?.[0] as unknown as { data: { domain: string } }
    expect(created.data.domain).toBe('cited.test')
  })

  it('rejects a class that is not a source quality class', async () => {
    const result = await approveCandidateAction({ candidateId: 1, qualityClass: 'excellent' })
    expect(result).toEqual({ ok: false, error: '"excellent" is not a source quality class.' })
    expect(createMock).not.toHaveBeenCalled()
  })

  // Creating a second row would collide on the unique domain, and quietly
  // editing the existing rule is a different act than the one asked for.
  it('refuses when an active rule already covers the domain', async () => {
    rules([{ id: 5, domain: 'cited.test', qualityClass: 'secondary', active: true }])
    const result = await approveCandidateAction({ candidateId: 1, qualityClass: 'primary' })
    expect(result).toEqual({
      ok: false,
      error: 'Already rated as secondary under cited.test. Edit that rule instead.',
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('refuses when a parent-domain rule covers it', async () => {
    findByIDMock.mockResolvedValue({ id: 1, domain: 'docs.cited.test' } as never)
    rules([{ id: 5, domain: 'cited.test', qualityClass: 'primary', active: true }])
    const result = await approveCandidateAction({ candidateId: 1, qualityClass: 'primary' })
    expect(result.ok).toBe(false)
  })

  // A deactivated row is not "covered", but it still owns the unique domain.
  it('revives a deactivated rule instead of creating a duplicate', async () => {
    rules([{ id: 5, domain: 'cited.test', qualityClass: 'unverified', active: false }])
    const result = await approveCandidateAction({ candidateId: 1, qualityClass: 'primary' })

    expect(result).toEqual({ ok: true })
    expect(createMock).not.toHaveBeenCalled()
    const ruleUpdate = updateMock.mock.calls[0]?.[0] as unknown as {
      collection: string
      id: number
      data: Record<string, unknown>
    }
    expect(ruleUpdate.collection).toBe('evidence-sources')
    expect(ruleUpdate.id).toBe(5)
    expect(ruleUpdate.data).toMatchObject({ qualityClass: 'primary', active: true })
  })

  it('reports a failure instead of throwing', async () => {
    createMock.mockRejectedValue(new Error('database is on fire') as never)
    const result = await approveCandidateAction({ candidateId: 1, qualityClass: 'primary' })
    expect(result).toEqual({ ok: false, error: 'database is on fire' })
  })
})

describe('dismissCandidateAction', () => {
  it('sets the status without touching evidence-sources', async () => {
    const result = await dismissCandidateAction(1)
    expect(result).toEqual({ ok: true })
    expect(createMock).not.toHaveBeenCalled()

    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      collection: string
      data: Record<string, unknown>
    }
    expect(call.collection).toBe('evidence-source-candidates')
    expect(call.data.status).toBe('dismissed')
    expect(call.data.resolvedBy).toBe('reviewer@example.com')
  })
})

describe('reopenCandidateAction', () => {
  it('clears who resolved it and unlinks any rule', async () => {
    await reopenCandidateAction(1)
    const call = updateMock.mock.calls[0]?.[0] as unknown as { data: Record<string, unknown> }
    expect(call.data).toMatchObject({
      status: 'pending',
      resolvedAt: null,
      resolvedBy: null,
      resolvedSource: null,
    })
  })
})
