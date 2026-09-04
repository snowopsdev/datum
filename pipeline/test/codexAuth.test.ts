import assert from 'node:assert/strict'
import path from 'node:path'
import { describe, it } from 'node:test'

import { codexAuthFilePresent, codexHome } from '../src/codexAuth'

describe('codexHome', () => {
  it('prefers CODEX_HOME over a .codex under HOME', () => {
    assert.equal(codexHome({ CODEX_HOME: '/opt/codex', HOME: '/home/op' }), '/opt/codex')
    assert.equal(codexHome({ HOME: '/home/op' }), path.join('/home/op', '.codex'))
  })
})

describe('codexAuthFilePresent', () => {
  it('checks only whether auth.json exists under the codex home', () => {
    for (const present of [false, true]) {
      const checked: unknown[] = []
      const result = codexAuthFilePresent({ CODEX_HOME: '/opt/codex' }, (file) => {
        checked.push(file)
        return present
      })
      assert.equal(result, present)
      assert.deepEqual(checked, [path.join('/opt/codex', 'auth.json')])
    }
  })
})
