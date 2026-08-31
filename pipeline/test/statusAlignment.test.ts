import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ARTICLE_STATUSES, STATUS_META } from '../src/articleStatusMeta'
import { stages } from '../src/stages'

// The enforcement that replaced AGENTS.md's "keep `stages.ts` and
// `articleStatus.ts` aligned" convention: the stage table and the shared
// status-metadata table must describe the same machine.
describe('status metadata stays aligned with the stage table', () => {
  it('every stage picks up the status the table says it does', () => {
    for (const stage of stages) {
      assert.equal(
        STATUS_META[stage.entryStatus].pickupStage,
        stage.name,
        `stage "${stage.name}" enters at "${stage.entryStatus}", but the table routes that status to "${STATUS_META[stage.entryStatus].pickupStage}"`,
      )
    }
  })

  it('every status with a pickupStage is some stage entry status', () => {
    const entryStatuses = new Set(stages.map((stage) => stage.entryStatus))
    for (const status of ARTICLE_STATUSES) {
      const { pickupStage } = STATUS_META[status]
      if (pickupStage !== null) {
        assert.ok(
          entryStatuses.has(status),
          `"${status}" claims pickup by "${pickupStage}" but no stage enters there`,
        )
      }
    }
  })

  it('every stage exit status exists in the table', () => {
    for (const stage of stages) {
      assert.ok(
        ARTICLE_STATUSES.includes(stage.exitStatus),
        `stage "${stage.name}" exits to unknown status "${stage.exitStatus}"`,
      )
    }
  })

  it('run-owned statuses are exactly the pickup statuses', () => {
    for (const status of ARTICLE_STATUSES) {
      const meta = STATUS_META[status]
      assert.equal(
        meta.owner === 'run',
        meta.pickupStage !== null,
        `"${status}" is ${meta.owner}-owned but pickupStage is ${meta.pickupStage}; the board would show "Datum is working" on a status no run touches (or the reverse)`,
      )
    }
  })
})
