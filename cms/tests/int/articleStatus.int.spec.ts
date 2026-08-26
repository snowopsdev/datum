import { describe, expect, it } from 'vitest'

import { Articles } from '@/collections/Articles'
import { ARTICLE_STATUSES, STATUS_COLUMNS } from '@/components/ops/articleStatus'
import { gateReviewOverride } from '@/lib/articleReviewGate'

describe('article status configuration', () => {
  it('matches ARTICLE_STATUSES to the Articles status field options exactly', () => {
    const statusField = Articles.fields.find((field) => 'name' in field && field.name === 'status') as
      | { options?: unknown[] }
      | undefined
    expect(statusField).toBeDefined()
    expect(ARTICLE_STATUSES).toEqual(statusField?.options)
  })

  it('has a STATUS_COLUMNS entry for every status', () => {
    const columnIds = STATUS_COLUMNS.map((column) => column.id)
    for (const status of ARTICLE_STATUSES) {
      expect(columnIds).toContain(status)
    }
  })

  it('registers gateReviewOverride as a beforeChange hook on Articles', () => {
    expect(Articles.hooks?.beforeChange).toContain(gateReviewOverride)
  })
})
