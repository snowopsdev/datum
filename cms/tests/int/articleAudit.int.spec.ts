import { describe, expect, it, vi } from 'vitest'

import { ArticleAudit } from '@/collections/ArticleAudit'
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
  })

  it('rejects updates and deletes even when collection access is bypassed', () => {
    const beforeChange = ArticleAudit.hooks?.beforeChange?.[0]
    const beforeDelete = ArticleAudit.hooks?.beforeDelete?.[0]

    expect(() => beforeChange?.({ operation: 'update' } as never)).toThrow('append-only')
    expect(() => beforeDelete?.({} as never)).toThrow('append-only')
  })
})
