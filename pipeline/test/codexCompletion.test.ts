import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { it } from 'node:test'

import {
  CodexLocalExecutionDisabledError,
  completeTextViaCodex,
} from '../src/codexCompletion'

it('rejects local Codex execution without starting a process or creating scratch files', async (t) => {
  const spawn = t.mock.method(childProcess, 'spawn', () => {
    throw new Error('unexpected process launch')
  })
  const mkdtemp = t.mock.method(fs, 'mkdtempSync', () => {
    throw new Error('unexpected scratch directory')
  })
  syncBuiltinESMExports()
  try {
    await assert.rejects(
      completeTextViaCodex({ system: 's', user: 'u', model: 'codex/gpt-5' }),
      (error: Error) => {
        assert.ok(error instanceof CodexLocalExecutionDisabledError)
        assert.match(error.message, /select an API-backed model instead/)
        return true
      },
    )
    assert.equal(spawn.mock.callCount(), 0)
    assert.equal(mkdtemp.mock.callCount(), 0)
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
  }
})
