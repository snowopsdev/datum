import { randomUUID } from 'node:crypto'
import { createLocalReq, getPayload } from 'payload'
import { expect, it, vi } from 'vitest'

vi.mock('../../../pipeline/src/brandVoice', () => ({
  loadActiveBrandVoice: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../../pipeline/src/fetchTopics', () => ({ fetchTopics: vi.fn() }))

import config from '@/payload.config'
import { ContentRunTask } from '@/jobs/contentRun'
import { fetchTopics } from '../../../pipeline/src/fetchTopics'

it('fails a queued run before buying topics when its brand voice is no longer active', async () => {
  const payload = await getPayload({ config: await config })
  const template = await payload.create({
    collection: 'templates',
    data: { name: `Gate ${randomUUID()}` },
  })
  const run = await payload.create({
    collection: 'pipeline-runs',
    overrideAccess: true,
    data: {
      runId: randomUUID(),
      source: 'admin',
      status: 'queued',
      mode: 'mock',
      template: template.id,
      requestedCount: 1,
      requestedBy: 'test',
      configFingerprint: 'test',
      configSnapshot: {},
    },
  })
  try {
    const req = await createLocalReq({}, payload)
    const handler = ContentRunTask.handler
    if (typeof handler !== 'function') throw new Error('Expected content-run handler')
    await expect(handler({ input: { runId: run.runId }, req } as never)).rejects.toThrow(
      'Finish setup',
    )
    expect(fetchTopics).not.toHaveBeenCalled()
    const failed = await payload.findByID({ collection: 'pipeline-runs', id: run.id, depth: 0 })
    expect(failed.status).toBe('failed')
    expect(failed.errorSummary).toContain('Finish setup')
  } finally {
    await payload.delete({ collection: 'pipeline-runs', id: run.id, overrideAccess: true })
    await payload.delete({ collection: 'templates', id: template.id, overrideAccess: true })
  }
})
