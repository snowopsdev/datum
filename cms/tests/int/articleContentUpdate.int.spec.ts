import { randomUUID } from 'node:crypto'
import { getPayload } from 'payload'
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { trackArticleContentUpdate } from '@/lib/articleContentUpdate'
import { buildArticleJsonLd } from '@/lib/articleJsonLd'
import { articleDateline } from '@/lib/articleReader'

describe('public-content modification date', () => {
  it('ignores operational saves and no-op content, but records public edits through Payload', async () => {
    const payload = await getPayload({ config })
    const article = await payload.create({
      collection: 'articles',
      data: {
        keyword: `content date ${randomUUID()}`,
        title: 'Original',
        status: 'published',
        publishedAt: '2026-01-05T12:00:00.000Z',
        faqItems: [{ question: 'Why?', answer: 'Because.' }],
      },
    })
    expect(article.contentUpdatedAt).toBeNull()
    const operational = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { reviewNotes: 'Internal note', title: 'Original', faqItems: article.faqItems },
    })
    expect(operational.contentUpdatedAt).toBeNull()
    expect(
      articleDateline({
        publishedAt: operational.publishedAt,
        updatedAt: operational.contentUpdatedAt,
        minutes: 1,
      }),
    ).toEqual(['Jan 5, 2026', '1 min read'])
    expect(buildArticleJsonLd(operational)[0].dateModified).toBe(article.publishedAt)

    const edited = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { metaDescription: 'A public edit.' },
    })
    expect(edited.contentUpdatedAt).toBeTruthy()
    expect(buildArticleJsonLd(edited)[0].dateModified).toBe(edited.contentUpdatedAt)
    expect(
      articleDateline({
        publishedAt: edited.publishedAt,
        updatedAt: edited.contentUpdatedAt,
        minutes: 1,
      }).join(' '),
    ).toContain('Updated')
    const archived = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { archived: true },
    })
    expect(archived.contentUpdatedAt).toBe(edited.contentUpdatedAt)
  })

  it('ignores FAQ storage IDs and refuses supplied timestamp changes', async () => {
    const originalDoc = {
      contentUpdatedAt: '2026-01-05T12:00:00.000Z',
      faqItems: [{ id: 'old', question: 'Why?', answer: 'Because.' }],
    }
    const result = await trackArticleContentUpdate({
      operation: 'update',
      originalDoc,
      data: {
        contentUpdatedAt: '2099-01-01T00:00:00.000Z',
        faqItems: [{ id: 'new', question: 'Why?', answer: 'Because.' }],
      },
    } as never)
    expect(result.contentUpdatedAt).toBe(originalDoc.contentUpdatedAt)
  })
})
