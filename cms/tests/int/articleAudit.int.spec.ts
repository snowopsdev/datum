import { describe, expect, it, vi } from 'vitest'

import { ArticleAudit } from '@/collections/ArticleAudit'
import { CostLog } from '@/collections/CostLog'
import { formatAuditTimestamp } from '@/components/ops/articleStatus'
import {
  auditEventLabel,
  SCORE_INVALIDATED_EVENT,
  scoreInvalidatedFields,
  scoreInvalidatedSummary,
  scoreInvalidationNotice,
} from '@/components/ops/auditTypes'
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

  it('labels score invalidation and humanises every other event', () => {
    expect(auditEventLabel(SCORE_INVALIDATED_EVENT)).toBe('Score invalidated by edit')
    expect(auditEventLabel('status_changed')).toBe('status changed')
  })

  it('round-trips the edited fields through the score-invalidation summary', () => {
    // The review page reads the field list back out of the summary, so the
    // builder and the reader have to agree; an unrelated summary yields null
    // rather than a nonsense notice.
    const summary = scoreInvalidatedSummary(['title', 'body'])
    expect(summary).toBe('Score invalidated by an edit to title, body')
    expect(scoreInvalidatedFields(summary)).toBe('title, body')
    expect(scoreInvalidatedFields('Reviewer overrode blocked')).toBeNull()
    expect(scoreInvalidatedFields(scoreInvalidatedSummary([]))).toBeNull()
  })

  describe('score-invalidation notice on the review page', () => {
    const auditRow = (event: string, summary: string) => ({
      event,
      summary,
      source: { kind: 'audit' as const, recordId: 1 },
    })
    const costRow = {
      event: 'model_call_completed',
      summary: 'generate call completed',
      source: { kind: 'cost' as const, recordId: 2 },
    }
    const invalidated = auditRow(SCORE_INVALIDATED_EVENT, scoreInvalidatedSummary(['title']))

    it('names the edited fields when the invalidation is the newest audit row', () => {
      expect(scoreInvalidationNotice('drafted', [invalidated])).toBe('title')
    })

    it('looks past cost-log rows, which nobody did', () => {
      expect(scoreInvalidationNotice('drafted', [costRow, invalidated])).toBe('title')
    })

    it('goes quiet once something else has happened to the article', () => {
      const later = auditRow('status_changed', 'status changed')
      expect(scoreInvalidationNotice('drafted', [later, invalidated])).toBeNull()
    })

    it('goes quiet once the article has moved on from drafted', () => {
      expect(scoreInvalidationNotice('qa_passed', [invalidated])).toBeNull()
    })

    it('says nothing on an article with no audit trail at all', () => {
      expect(scoreInvalidationNotice('drafted', [])).toBeNull()
      expect(scoreInvalidationNotice('drafted', [costRow])).toBeNull()
    })
  })

  it('formats audit timestamps deterministically in UTC', () => {
    expect(formatAuditTimestamp('2026-08-24T18:17:31Z')).toBe('Aug 24, 2026, 6:17 PM UTC')
    expect(formatAuditTimestamp('not-a-date')).toBe('Unknown time')
  })
})
