import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { ArticleInActiveRunError, createPipelineRun } from '@/lib/createPipelineRun'
import { resolveWorkspaceProfile } from '@/lib/tenant'
import { evaluateWorkspaceReadiness } from '@/lib/workspaceReadiness'
import { getPayload, type TypedUser } from 'payload'
import { expect, it } from 'vitest'

it.each(['separate', 'same', 'overlapping'] as const)(
  'handles concurrent selected runs for %s articles atomically',
  async (selection) => {
    const payload = await getPayload({ config: await config })
    const template = await payload.create({
      collection: 'templates', overrideAccess: true,
      data: { name: `QA selected concurrency ${randomUUID()}` },
    })
    const runIds = [randomUUID(), randomUUID()]
    const articles = await Promise.all([0, 1].map(() => payload.create({
      collection: 'articles', overrideAccess: true,
      data: { keyword: `QA selected ${randomUUID()}`, template: template.id, status: 'topic_selected' },
    })))
    const selections = selection === 'separate'
      ? [[articles[0].id], [articles[1].id]]
      : selection === 'same'
        ? [[articles[0].id], [articles[0].id]]
        : [[articles[0].id, articles[1].id], [articles[1].id]]
    const readiness = evaluateWorkspaceReadiness({
      env: { MOCK_MODE: 'true' }, models: null,
      activeVoice: { id: 1, updatedAt: new Date(0).toISOString() },
      templates: [{ id: template.id, name: template.name, updatedAt: template.updatedAt }],
      profile: resolveWorkspaceProfile(null, {}, { mockDefault: true }),
      icps: [{ id: 5, updatedAt: new Date(0).toISOString(), name: 'Demo', primary: true }],
      positioning: { content: null, updatedAt: null },
      evidenceBank: { content: null, updatedAt: null, asOf: '2026-09-05' },
    })
    try {
      const results = await Promise.allSettled(runIds.map((runId, index) => createPipelineRun(
        payload,
        { id: 1, collection: 'users', email: 'admin@datum.local' } as TypedUser,
        { source: 'selected', templateId: template.id, count: 1, runId,
          articleIds: selections[index], requestedBy: 'admin@datum.local', readiness },
      )))
      const expectedCount = selection === 'separate' ? 2 : 1
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(expectedCount)
      const rejected = results.filter((result) => result.status === 'rejected')
      expect(rejected).toHaveLength(2 - expectedCount)
      for (const result of rejected) {
        expect(result.reason).toBeInstanceOf(ArticleInActiveRunError)
      }
      const runs = await payload.find({ collection: 'pipeline-runs', overrideAccess: true,
        where: { runId: { in: runIds } }, pagination: false })
      const jobs = await payload.find({ collection: 'payload-jobs', overrideAccess: true,
        where: { 'input.runId': { in: runIds } }, pagination: false })
      expect(runs.docs).toHaveLength(expectedCount)
      expect(jobs.docs).toHaveLength(expectedCount)
    } finally {
      await payload.delete({ collection: 'payload-jobs', overrideAccess: true,
        where: { 'input.runId': { in: runIds } } })
      await payload.delete({ collection: 'pipeline-runs', overrideAccess: true,
        where: { runId: { in: runIds } } })
      // The article's append-only audit record retains its relationship. Keep
      // the article and template, as the other database-backed suites do.
    }
  },
)
