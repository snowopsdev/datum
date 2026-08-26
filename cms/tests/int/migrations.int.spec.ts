import { up } from '@/migrations/20260826_015027_existing_schema_baseline'
import { describe, expect, it, vi } from 'vitest'

describe('existing schema baseline migration', () => {
  it('records the baseline without recreating an existing Datum schema', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ users: 'users' }] })

    await up({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('creates the baseline schema for a fresh database', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ users: null }] })
      .mockResolvedValueOnce(undefined)

    await up({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(2)
  })
})
