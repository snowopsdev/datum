import { beforeEach, describe, expect, it, vi } from 'vitest'

// Same harness as articleActions.int.spec: no Next request scope, no Payload boot.
const authMock = vi.fn(async () => ({ user: { id: 7, email: 'editor@example.com' } }))
const findByIDMock = vi.fn(async (_args: unknown) => ({}) as never)
const updateMock = vi.fn(async (_args: unknown) => ({}) as never)
/** Active-run lookup in `queueRunForArticles`: nothing is carrying the article by default. */
const findMock = vi.fn(async (_args: unknown) => ({ docs: [] }) as never)
const createRunMock = vi.fn(async (_payload: unknown, _user: unknown, _input: unknown) => undefined)
/** Two active audiences, so a brief has something to switch between. */
const ICPS = [
  {
    id: 11,
    name: 'Marketing lead',
    primary: true,
    audienceLine: 'A marketing lead. Main pain: briefs.',
  },
  { id: 12, name: 'Founder', primary: false, audienceLine: 'A founder. Main pain: time.' },
]
/** The workspace the next action sees. Tests flip `mode` to reach the live gate. */
let readiness: Record<string, unknown>
const freshReadiness = () => ({
  mode: 'mock',
  runtime: { ready: true, missing: [], problems: [], blockers: [] },
  governance: { ready: true, activeVoiceId: 1, problems: [], blockers: [] },
  content: { ready: true, templateCount: 3, models: [] },
  configFingerprint: 'x',
})
const setupMock = vi.fn(async () => ({
  readiness,
  templates: [],
  icps: ICPS,
  latestRun: null,
}))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: vi.fn(async () => ({
      auth: authMock,
      find: findMock,
      findByID: findByIDMock,
      update: updateMock,
    })),
  }
})
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createRunMock }
})
vi.mock('@/lib/loadWorkspaceReadiness', () => ({
  loadWorkspaceSetup: setupMock,
  loadActiveAudienceOptions: vi.fn(async () => ICPS),
}))

const { approveBriefAction, revisitBriefAction, saveBriefAction } =
  await import('@/components/ops/briefActions')

/** The `updatedAt` the editor in these tests opened the brief at. */
const LOADED = '2026-01-01T10:00:00.000Z'

const atBrief = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    status: 'brief_review',
    template: 3,
    updatedAt: LOADED,
    brief: { angle: 'old', angleOptions: [{angle:'Option', rationale:'Pain', pain:null, gaps:[]}], sections: [{ heading: 'A', source: 'template' }], notes: '' },
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
  icpId: null,
}

beforeEach(() => {
  findByIDMock.mockReset()
  updateMock.mockReset()
  createRunMock.mockReset()
  findMock.mockReset()
  findMock.mockResolvedValue({ docs: [] } as never)
  readiness = freshReadiness()
  // `queueRunForArticles` queues the article the update wrote, so the update
  // has to hand a document back the way Payload does.
  updateMock.mockImplementation(async (args: unknown) => {
    const { id, data } = args as { id: number; data: Record<string, unknown> }
    return { id, template: 3, ...data } as never
  })
})

describe('saveBriefAction', () => {
  it('trims, drops blank sections, and writes the brief without changing status', async () => {
    findByIDMock.mockResolvedValue(atBrief())
    const result = await saveBriefAction(1, edits, LOADED)
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { brief: Record<string, unknown>; status?: string }
    }
    expect(call.data.status).toBeUndefined()
    expect(call.data.brief.angle).toBe('New angle')
    expect(call.data.brief.angleOptions).toEqual([{angle:'Option', rationale:'Pain', pain:null, gaps:[]}])
    expect(call.data.brief.sections).toEqual([
      { heading: 'A', notes: 'say this', source: 'template' },
    ])
    expect(call.data.brief.notes).toBe('Lead with the routine.')
  })

  it('refuses once the brief has been approved', async () => {
    findByIDMock.mockResolvedValue(atBrief({ status: 'researched' }))
    const result = await saveBriefAction(1, edits, LOADED)
    expect(result.ok).toBe(false)
    expect(updateMock).not.toHaveBeenCalled()
  })

  // The save replaces the whole brief, so a colleague's save (or an accepted
  // suggestion) after the page loaded would be silently overwritten.
  describe('when someone else saved since the editor opened', () => {
    const NEWER = '2026-01-01T10:05:00.000Z'

    it('refuses with a message that says to reload, and writes nothing', async () => {
      findByIDMock.mockResolvedValue(atBrief({ updatedAt: NEWER }))
      const result = await saveBriefAction(1, edits, LOADED)
      expect(result).toEqual({
        ok: false,
        error: 'Someone else saved this brief since you opened it. Reload to see their changes.',
      })
      expect(updateMock).not.toHaveBeenCalled()
    })

    it('saves when the editor holds the stored version, which is how a second save goes through', async () => {
      findByIDMock.mockResolvedValue(atBrief({ updatedAt: NEWER }))
      const result = await saveBriefAction(1, edits, NEWER)
      expect(result.ok).toBe(true)
      expect(updateMock).toHaveBeenCalledTimes(1)
    })

    it('has nothing to compare when the editor sent no version', async () => {
      findByIDMock.mockResolvedValue(atBrief({ updatedAt: NEWER }))
      expect((await saveBriefAction(1, edits, null)).ok).toBe(true)
    })
  })

  // Switching the audience is the one edit that rewrites another field, so the
  // rule that decides when it may is pinned from both sides.
  it('replaces the audience line when it is still the previous audience’s own', async () => {
    findByIDMock.mockResolvedValue(atBrief({ icp: 11 }))
    const result = await saveBriefAction(
      1,
      { ...edits, audience: ICPS[0].audienceLine, icpId: 12 },
      LOADED,
    )
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { icp: number; brief: { audience: string } }
    }
    expect(call.data.icp).toBe(12)
    expect(call.data.brief.audience).toBe(ICPS[1].audienceLine)
  })

  it('leaves an edited audience line alone when the audience changes', async () => {
    findByIDMock.mockResolvedValue(atBrief({ icp: 11 }))
    await saveBriefAction(1, { ...edits, audience: 'Whoever buys the thing', icpId: 12 }, LOADED)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { icp: number; brief: { audience: string } }
    }
    expect(call.data.icp).toBe(12)
    expect(call.data.brief.audience).toBe('Whoever buys the thing')
  })

  it('does not touch the relationship when the audience did not change', async () => {
    findByIDMock.mockResolvedValue(atBrief({ icp: 11 }))
    await saveBriefAction(1, { ...edits, icpId: 11 }, LOADED)
    const call = updateMock.mock.calls[0]?.[0] as unknown as { data: Record<string, unknown> }
    expect('icp' in call.data).toBe(false)
  })
})

describe('approveBriefAction', () => {
  it('moves the piece to researched, stamps the approval, and queues a run for it', async () => {
    findByIDMock.mockResolvedValue(atBrief())
    const result = await approveBriefAction(1, edits)
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { status: string; brief: { approvedAt?: string; approvedBy?: string; angle?: string; angleOptions?: unknown } }
      context: { articleAudit: { event: string } }
    }
    expect(call.data.status).toBe('researched')
    expect(call.data.brief.approvedBy).toBe('editor@example.com')
    expect(call.data.brief.approvedAt).toMatch(/^\d{4}-/)
    // Edits handed in with the approval are kept, not thrown away.
    expect(call.data.brief.angle).toBe('New angle')
    expect(call.data.brief.angleOptions).toEqual([{angle:'Option', rationale:'Pain', pain:null, gaps:[]}])
    expect(call.context.articleAudit.event).toBe('brief_approved')

    expect(createRunMock).toHaveBeenCalledTimes(1)
    const runInput = createRunMock.mock.calls[0]?.[2] as unknown as {
      source: string
      articleIds: number[]
    }
    expect(runInput.source).toBe('selected')
    expect(runInput.articleIds).toEqual([1])
  })

  it('writes the chosen audience and its derived line through the approval', async () => {
    findByIDMock.mockResolvedValue(atBrief({ icp: 11 }))
    const result = await approveBriefAction(1, {
      ...edits,
      audience: ICPS[0].audienceLine,
      icpId: 12,
    })
    expect(result.ok).toBe(true)
    const call = updateMock.mock.calls[0]?.[0] as unknown as {
      data: { icp: number; brief: { audience: string } }
    }
    expect(call.data.icp).toBe(12)
    expect(call.data.brief.audience).toBe(ICPS[1].audienceLine)
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

  /**
   * The one gate, reached from here too: approving a brief in live mode starts
   * the expensive half of the pipeline, so it asks for the same confirmation
   * the board's Run button does — and refuses in the same words.
   */
  it('refuses in live mode until the live cost is confirmed, and writes nothing', async () => {
    readiness = { ...freshReadiness(), mode: 'live' }
    findByIDMock.mockResolvedValue(atBrief())
    const result = await approveBriefAction(1, edits)
    expect(result).toEqual({
      ok: false,
      error: 'Confirm the live provider cost before starting this run.',
    })
    expect(updateMock).not.toHaveBeenCalled()
    expect(createRunMock).not.toHaveBeenCalled()
  })

  it('approves and queues in live mode once the cost is confirmed', async () => {
    readiness = { ...freshReadiness(), mode: 'live' }
    findByIDMock.mockResolvedValue(atBrief())
    const result = await approveBriefAction(1, edits, { confirmLiveCost: true })
    expect(result.ok).toBe(true)
    expect(createRunMock).toHaveBeenCalledTimes(1)
  })

  it('reports a research run that still lists the piece instead of promising writing', async () => {
    findByIDMock.mockResolvedValue(atBrief())
    findMock.mockResolvedValueOnce({ docs: [{ runId: 'research-run' }] } as never)
    const result = await approveBriefAction(1, edits)
    expect(result).toEqual({
      ok: true,
      message:
        'Brief approved. The research run has not finished yet — run the next stage once it has.',
    })
    expect(createRunMock).not.toHaveBeenCalled()
  })

  it('uses the shared gate wording when the runtime is not configured', async () => {
    readiness = {
      ...freshReadiness(),
      runtime: { ready: false, missing: [], problems: [], blockers: ['OPENAI_API_KEY'] },
    }
    findByIDMock.mockResolvedValue(atBrief())
    const result = await approveBriefAction(1, edits)
    expect(result).toEqual({
      ok: false,
      error: 'Configure the required environment variables: OPENAI_API_KEY.',
    })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('revisitBriefAction', () => {
  const draftOf = (status: string, over: Record<string, unknown> = {}) =>
    atBrief({ status, brief: { approvedAt: 'x', approvedBy: 'y' }, ...over })

  const written = () =>
    updateMock.mock.calls[0]?.[0] as unknown as {
      data: Record<string, unknown> & { brief: { approvedAt: null; approvedBy: null } }
      overrideAccess: boolean
    }

  for (const status of ['needs_revision', 'needs_review', 'blocked'] as const) {
    it(`sends ${status} back to its brief and clears the approval`, async () => {
      findByIDMock.mockResolvedValue(draftOf(status))
      const result = await revisitBriefAction(1)
      expect(result.ok).toBe(true)
      const call = written()
      expect(call.data.status).toBe('brief_review')
      expect(call.data.brief.approvedAt).toBeNull()
    })
  }

  // The draft is going to be rewritten, so everything that described it goes
  // with it: otherwise a stale schedule, regeneration notes, QA verdict or
  // information-gain decision sits next to a body nobody has written yet.
  it('clears the schedule, revision notes, every QA group and the information-gain decision', async () => {
    findByIDMock.mockResolvedValue(draftOf('needs_revision'))
    await revisitBriefAction(1)
    const { data, overrideAccess } = written()
    expect(data.publishAt).toBeNull()
    expect(data.revisionNotes).toBeNull()
    const qa = data.qaResults as Record<string, Record<string, unknown>>
    expect(Object.keys(qa).sort()).toEqual(
      ['evidenceCheck', 'factCheck', 'qualitativeReview', 'structural'],
    )
    for (const group of Object.values(qa)) {
      expect(Object.values(group).every((value) => value === null)).toBe(true)
    }
    const ig = data.informationGain as Record<string, unknown>
    expect(Object.keys(ig).length).toBeGreaterThan(0)
    expect(Object.values(ig).every((value) => value === null)).toBe(true)
    // `informationGain` is access-guarded, so only an unrestricted write can clear it.
    expect(overrideAccess).toBe(true)
  })

  it('refuses while an active run lists the article, and writes nothing', async () => {
    findByIDMock.mockResolvedValue(draftOf('needs_revision'))
    findMock.mockResolvedValue({ docs: [{ runId: 'run-9' }] } as never)
    const result = await revisitBriefAction(1)
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('active run'),
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses every status that is not waiting on a reviewer', async () => {
    for (const status of ['published', 'topic_selected', 'researched', 'drafted', 'qa_passed', 'verified', 'approved']) {
      updateMock.mockClear()
      findByIDMock.mockResolvedValue(draftOf(status))
      expect((await revisitBriefAction(1)).ok, status).toBe(false)
      expect(updateMock, status).not.toHaveBeenCalled()
    }
  })

  it('treats a piece already at its brief as nothing to do', async () => {
    findByIDMock.mockResolvedValue(draftOf('brief_review'))
    expect(await revisitBriefAction(1)).toEqual({ ok: true, message: 'Already at the brief.' })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
