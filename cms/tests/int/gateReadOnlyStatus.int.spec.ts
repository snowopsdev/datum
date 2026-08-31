import { randomUUID } from 'node:crypto'

import config from '@/payload.config'
import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

let payload: Payload

const makeArticle = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'articles',
    overrideAccess: true,
    data: { keyword: `readonly gate ${randomUUID()}`, ...data } as never,
  })

describe('gateReadOnlyStatus', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('rejects a body edit while the machine owns the article', async () => {
    const article = await makeArticle({ status: 'qa_passed', title: 'before' })
    await expect(
      payload.update({
        collection: 'articles',
        id: article.id,
        overrideAccess: true,
        data: { title: 'sneaky edit mid-run' },
      }),
    ).rejects.toThrow(/read-only until the run finishes/)
  })

  it('lets the pipeline write during its own statuses', async () => {
    const article = await makeArticle({ status: 'drafted' })
    const updated = await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { title: 'draft output', status: 'qa_passed' },
      context: {
        articleAudit: {
          actor: 'pipeline',
          actorType: 'pipeline',
          event: 'qa_completed',
          stage: 'qa',
        },
      },
    })
    expect(updated.title).toBe('draft output')
  })

  it('lets a person pull the article out of a machine status, notes included', async () => {
    const article = await makeArticle({ status: 'qa_passed' })
    const updated = await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { status: 'needs_revision', reviewNotes: 'redo this' },
    })
    expect(updated.status).toBe('needs_revision')
  })

  it('allows edits that touch none of the scored fields', async () => {
    const article = await makeArticle({ status: 'drafted' })
    const updated = await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { archived: true },
    })
    expect(updated.archived).toBe(true)
  })

  it('leaves human-owned statuses editable', async () => {
    const article = await makeArticle({ status: 'needs_revision', title: 'old' })
    const updated = await payload.update({
      collection: 'articles',
      id: article.id,
      overrideAccess: true,
      data: { title: 'reviewer fix' },
    })
    expect(updated.title).toBe('reviewer fix')
  })
})
