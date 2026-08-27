import { describe, expect, it } from 'vitest'

import { Articles } from '@/collections/Articles'
import { ARTICLE_STATUSES, CONTENT_STAGES, STATUS_STAGE, stageOf } from '@/components/ops/articleStatus'
import { gateReviewOverride } from '@/lib/articleReviewGate'

describe('article status configuration', () => {
  it('matches ARTICLE_STATUSES to the Articles status field options exactly', () => {
    const statusField = Articles.fields.find(
      (field) => 'name' in field && field.name === 'status',
    ) as { options?: unknown[] } | undefined
    expect(statusField).toBeDefined()
    expect(ARTICLE_STATUSES).toEqual(statusField?.options)
  })

  it('maps every status to one of the five stages, with an owner', () => {
    for (const status of ARTICLE_STATUSES) {
      const info = STATUS_STAGE[status]
      expect(info, status).toBeDefined()
      expect(CONTENT_STAGES).toContain(info.stage)
      expect(info.step).toBe(CONTENT_STAGES.indexOf(info.stage) + 1)
      expect(['run', 'you', 'done']).toContain(info.owner)
    }
  })

  it('gives every status a person owns a verb, and none to the ones Datum owns', () => {
    for (const status of ARTICLE_STATUSES) {
      const info = STATUS_STAGE[status]
      if (info.owner === 'you') expect(info.action, status).toBeTruthy()
      else expect(info.action, status).toBeNull()
    }
  })

  it('puts the brief checkpoint at step 2, waiting on a person', () => {
    expect(stageOf('brief_review')).toMatchObject({ stage: 'brief', step: 2, owner: 'you' })
  })

  it('does not throw on a status it has never heard of', () => {
    expect(stageOf('something_new').stage).toBe('research')
  })

  it('registers gateReviewOverride as a beforeChange hook on Articles', () => {
    expect(Articles.hooks?.beforeChange).toContain(gateReviewOverride)
  })
})
