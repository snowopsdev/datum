import { describe, expect, it, vi } from 'vitest'

import { ArticleAudit } from '@/collections/ArticleAudit'
import { CostLog } from '@/collections/CostLog'
import { formatAuditTimestamp } from '@/components/ops/articleStatus'
import { auditArticleChange } from '@/lib/articleAudit'

describe('article audit trail', () => {
  it('records supplied pipeline provenance and the status transition', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })

    await auditArticleChange({
      context: {
        articleAudit: {
          actor: 'pipeline',
          actorType: 'pipeline',
          event: 'research_completed',
          pipelineRunId: 'run-123',
          stage: 'research',
          summary: 'research completed in mock mode',
          details: { mode: 'mock', output: { rankingPagesSummary: '#1 Example' } },
        },
      },
      data: { status: 'researched' },
      doc: { id: 42, status: 'researched' },
      operation: 'update',
      previousDoc: { id: 42, status: 'topic_selected' },
      req: { payload: { create }, user: null },
    } as never)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'article-audit',
        overrideAccess: true,
        data: expect.objectContaining({
          article: 42,
          actor: 'pipeline',
          actorType: 'pipeline',
          event: 'research_completed',
          pipelineRunId: 'run-123',
          stage: 'research',
          fromStatus: 'topic_selected',
          toStatus: 'researched',
        }),
      }),
    )
  })

  it('records unannotated admin edits with the authenticated actor', async () => {
    const create = vi.fn().mockResolvedValue({ id: 2 })

    await auditArticleChange({
      context: {},
      data: { title: 'Revised title' },
      doc: { id: 42, status: 'drafted' },
      operation: 'update',
      previousDoc: { id: 42, status: 'drafted' },
      req: { payload: { create }, user: { id: 7, email: 'editor@example.com' } },
    } as never)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: 'editor@example.com',
          actorType: 'user',
          event: 'article_updated',
          details: { changedFields: ['title'] },
        }),
      }),
    )
    const auditData = create.mock.calls[0]?.[0]?.data
    expect(auditData).not.toHaveProperty('fromStatus')
    expect(auditData).not.toHaveProperty('toStatus')
  })

  it('rejects updates and deletes even when collection access is bypassed', () => {
    const beforeChange = ArticleAudit.hooks?.beforeChange?.[0]
    const beforeDelete = ArticleAudit.hooks?.beforeDelete?.[0]

    expect(() => beforeChange?.({ operation: 'update' } as never)).toThrow('append-only')
    expect(() => beforeDelete?.({} as never)).toThrow('append-only')
  })

  it('protects model evidence and permits only authenticated reads', async () => {
    const read = CostLog.access?.read
    const create = CostLog.access?.create
    const update = CostLog.access?.update
    const remove = CostLog.access?.delete
    const beforeChange = CostLog.hooks?.beforeChange?.[0]
    const beforeDelete = CostLog.hooks?.beforeDelete?.[0]

    expect(await read?.({ req: { user: null } } as never)).toBe(false)
    expect(await read?.({ req: { user: { id: 7 } } } as never)).toBe(true)
    expect(await create?.({} as never)).toBe(false)
    expect(await update?.({} as never)).toBe(false)
    expect(await remove?.({} as never)).toBe(false)
    expect(() => beforeChange?.({ operation: 'update' } as never)).toThrow('append-only')
    expect(() => beforeDelete?.({} as never)).toThrow('append-only')
  })

  it('formats audit timestamps deterministically in UTC', () => {
    expect(formatAuditTimestamp('2026-08-24T18:17:31Z')).toBe('Aug 24, 2026, 6:17 PM UTC')
    expect(formatAuditTimestamp('not-a-date')).toBe('Unknown time')
  })
})
