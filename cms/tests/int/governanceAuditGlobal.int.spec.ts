import { describe, expect, it, vi } from 'vitest'

import { GovernanceAudit } from '@/collections/GovernanceAudit'
import { auditGlobalChange } from '@/lib/governanceAudit'

const hook = auditGlobalChange('information-gain-policy', 'information_gain_policy')

describe('global governance audit', () => {
  it('records the fields that actually changed, with before and after values', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 })

    await hook({
      context: {},
      data: { minConsensusCoverage: 0.8 },
      doc: { minConsensusCoverage: 0.8, minVerificationRatio: 0.9 },
      previousDoc: { minConsensusCoverage: 0.75, minVerificationRatio: 0.9 },
      req: { payload: { create }, user: { email: 'a@b.c' } },
    } as never)

    expect(create).toHaveBeenCalledTimes(1)
    const call = create.mock.calls[0][0]
    expect(call.collection).toBe('governance-audit')
    expect(call.overrideAccess).toBe(true)
    expect(call.data.subjectGlobal).toBe('information-gain-policy')
    expect(call.data.subject).toBeUndefined()
    expect(call.data.event).toBe('information_gain_policy_updated')
    expect(call.data.summary).toBe('information gain policy updated')
    expect(call.data.actorType).toBe('user')
    expect(call.data.actor).toBe('a@b.c')
    expect(call.data.details.changedFields).toEqual(['minConsensusCoverage'])
    expect(call.data.details.before).toEqual({ minConsensusCoverage: 0.75 })
    expect(call.data.details.after).toEqual({ minConsensusCoverage: 0.8 })
  })

  it('writes nothing when an unannotated save changed nothing', async () => {
    const create = vi.fn()

    await hook({
      context: {},
      data: { minConsensusCoverage: 0.75, updatedAt: '2026-01-02T00:00:00.000Z' },
      doc: { minConsensusCoverage: 0.75 },
      previousDoc: { minConsensusCoverage: 0.75, updatedAt: '2026-01-01T00:00:00.000Z' },
      req: { payload: { create }, user: { email: 'a@b.c' } },
    } as never)

    expect(create).not.toHaveBeenCalled()
  })

  it('still records an annotated change that moved no fields', async () => {
    const create = vi.fn().mockResolvedValue({ id: 2 })

    await hook({
      context: {
        governanceAudit: { event: 'policy_reviewed', summary: 'reviewed, no change' },
      },
      data: { minConsensusCoverage: 0.75 },
      doc: { minConsensusCoverage: 0.75 },
      previousDoc: { minConsensusCoverage: 0.75 },
      req: { payload: { create }, user: null },
    } as never)

    const call = create.mock.calls[0][0]
    expect(call.data.event).toBe('policy_reviewed')
    expect(call.data.summary).toBe('reviewed, no change')
    expect(call.data.actorType).toBe('system')
    expect(call.data.actor).toBe('system')
  })
})

describe('governance audit subject exclusivity', () => {
  const gate = GovernanceAudit.hooks?.beforeValidate?.[0]

  it('accepts exactly one of subject or subjectGlobal', () => {
    expect(() =>
      gate?.({ data: { subject: { relationTo: 'brand-voices', value: 1 } } } as never),
    ).not.toThrow()
    expect(() => gate?.({ data: { subjectGlobal: 'llm-settings' } } as never)).not.toThrow()
  })

  it('rejects both together and neither at all', () => {
    expect(() =>
      gate?.({
        data: { subject: { relationTo: 'brand-voices', value: 1 }, subjectGlobal: 'llm-settings' },
      } as never),
    ).toThrow('exactly one of subject or subjectGlobal')
    expect(() => gate?.({ data: { event: 'orphan' } } as never)).toThrow(
      'exactly one of subject or subjectGlobal',
    )
    expect(() => gate?.({ data: { subjectGlobal: '  ' } } as never)).toThrow(
      'exactly one of subject or subjectGlobal',
    )
  })
})
