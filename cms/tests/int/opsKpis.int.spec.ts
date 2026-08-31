import { runHealth, stageKpis } from '@/lib/opsKpis'
import { describe, expect, it } from 'vitest'

describe('stageKpis', () => {
  it('aggregates calls, tokens, and cost per stage, most expensive first', () => {
    const rows = [
      { stage: 'generate', inputTokens: 100, outputTokens: 50, costUsd: 0.2 },
      { stage: 'generate', inputTokens: 200, outputTokens: 70, costUsd: 0.3 },
      { stage: 'factCheck', inputTokens: 10, outputTokens: 5, costUsd: 0.9 },
      { stage: null, costUsd: null },
    ]
    expect(stageKpis(rows)).toEqual([
      { stage: 'factCheck', calls: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.9 },
      { stage: 'generate', calls: 2, inputTokens: 300, outputTokens: 120, costUsd: 0.5 },
      { stage: '(unknown)', calls: 1, inputTokens: 0, outputTokens: 0, costUsd: 0 },
    ])
  })

  it('returns an empty list for no rows', () => {
    expect(stageKpis([])).toEqual([])
  })
})

describe('runHealth', () => {
  it('counts outcomes and keeps at most five recent failures', () => {
    const runs = [
      { runId: 'ok-1', status: 'succeeded' },
      { runId: 'live', status: 'running' },
      { runId: 'wait', status: 'queued' },
      ...Array.from({ length: 7 }, (_, i) => ({
        runId: `bad-${i}`,
        status: 'failed',
        errorSummary: `boom ${i}`,
        completedAt: `2026-08-3${i}T00:00:00.000Z`,
      })),
    ]
    const health = runHealth(runs)
    expect(health.total).toBe(10)
    expect(health.succeeded).toBe(1)
    expect(health.failed).toBe(7)
    expect(health.active).toBe(2)
    expect(health.recentFailures).toHaveLength(5)
    expect(health.recentFailures[0]).toEqual({
      runId: 'bad-0',
      errorSummary: 'boom 0',
      completedAt: '2026-08-30T00:00:00.000Z',
    })
  })
})
