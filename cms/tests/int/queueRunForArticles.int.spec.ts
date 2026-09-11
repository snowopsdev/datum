import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceReadiness } from '@/lib/workspaceReadiness'

/**
 * The one way to queue a run for articles that already exist. Both the board's
 * Run button and the reviewer's reset/regenerate actions go through it, so the
 * refusals it makes are the refusals everyone sees — and it is called here
 * directly, with no server action in front of it, because it deliberately
 * lives outside that surface.
 *
 * `createPipelineRun` is stubbed: it opens a Postgres transaction and takes an
 * advisory lock, neither of which this function decides anything about.
 */
const { createPipelineRunMock } = vi.hoisted(() => ({ createPipelineRunMock: vi.fn() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/createPipelineRun', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/createPipelineRun')>()
  return { ...actual, createPipelineRun: createPipelineRunMock }
})

/** Enough of `WorkspaceReadiness` to reach `createPipelineRun`; it reads the rest. */
const readiness = () =>
  ({
    mode: 'mock',
    runtime: { ready: true, missing: [], blockers: [] },
    governance: { ready: true, activeVoiceId: 1, problems: [] },
  }) as unknown as WorkspaceReadiness

const { revalidatePath } = await import('next/cache')
const { queueRunForArticles } = await import('@/lib/queueRunForArticles')

const payload = {} as never
const user = { id: 7, email: 'reviewer@example.com' } as never

beforeEach(() => {
  vi.clearAllMocks()
  createPipelineRunMock.mockResolvedValue(undefined)
})

describe('queueRunForArticles', () => {
  it('queues one selected run and returns its id', async () => {
    const { runId } = await queueRunForArticles(
      payload,
      user,
      [{ id: 1, status: 'drafted', template: 3 }] as never,
      readiness(),
    )
    expect(runId).toEqual(expect.any(String))
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      payload,
      user,
      expect.objectContaining({
        runId,
        source: 'selected',
        templateId: 3,
        count: 1,
        articleIds: [1],
        requestedBy: 'reviewer@example.com',
      }),
    )
    // The board and the dashboard both show the run, wherever it was queued from.
    expect(revalidatePath).toHaveBeenCalledWith('/admin/ops/content')
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
  })

  it('takes the run row template from the first article of a mixed selection', async () => {
    await queueRunForArticles(
      payload,
      user,
      [
        { id: 1, status: 'drafted', template: { id: 5, name: 'Guide' } },
        { id: 2, status: 'researched', template: 9 },
      ] as never,
      readiness(),
    )
    expect(createPipelineRunMock).toHaveBeenCalledWith(
      payload,
      user,
      expect.objectContaining({ templateId: 5, count: 2, articleIds: [1, 2] }),
    )
  })

  it('refuses a status no stage waits on rather than reporting a run that does nothing', async () => {
    await expect(
      queueRunForArticles(
        payload,
        user,
        [{ id: 1, status: 'approved', template: 3 }] as never,
        readiness(),
      ),
    ).rejects.toThrow('1 article cannot be advanced by a run')
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('refuses an article with no template, which the pipeline would skip', async () => {
    await expect(
      queueRunForArticles(
        payload,
        user,
        [{ id: 1, status: 'drafted', template: null }] as never,
        readiness(),
      ),
    ).rejects.toThrow('Assign a template to 1 article first')
    expect(createPipelineRunMock).not.toHaveBeenCalled()
  })

  it('refuses an empty selection', async () => {
    await expect(queueRunForArticles(payload, user, [], readiness())).rejects.toThrow(
      'Those articles no longer exist.',
    )
  })
})
