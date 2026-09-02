import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'

import {
  checkCodexLogin,
  codexAuthFilePresent,
  codexHome,
  ensureManagedCodexHome,
} from '../src/codexAuth'

const tempDirs: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-auth-test-'))
  tempDirs.push(dir)
  return dir
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { force: true, recursive: true })
})

type SpawnCall = { command: string; args: string[]; stdio: string[] }

function fakeSpawn(outcome: { code: number } | { error: Error }) {
  const calls: SpawnCall[] = []
  const spawn = (command: string, args: string[], options: { stdio: string[] }) => {
    calls.push({ command, args, stdio: options.stdio })
    const child = new EventEmitter()
    setImmediate(() => {
      if ('error' in outcome) child.emit('error', outcome.error)
      else child.emit('close', outcome.code)
    })
    return child
  }
  return { calls, spawn }
}

describe('codexHome', () => {
  it('prefers CODEX_HOME over a .codex under HOME', () => {
    assert.equal(codexHome({ CODEX_HOME: '/opt/codex', HOME: '/home/op' }), '/opt/codex')
    assert.equal(codexHome({ HOME: '/home/op' }), path.join('/home/op', '.codex'))
  })
})

describe('codexAuthFilePresent', () => {
  it('reports whether auth.json exists under the codex home', () => {
    const home = tempDir()
    assert.equal(codexAuthFilePresent({ CODEX_HOME: home }), false)
    fs.writeFileSync(path.join(home, 'auth.json'), '{}')
    assert.equal(codexAuthFilePresent({ CODEX_HOME: home }), true)
  })
})

describe('checkCodexLogin', () => {
  it('runs `codex login status` with stdin closed and resolves true on a zero exit', async () => {
    const { calls, spawn } = fakeSpawn({ code: 0 })
    assert.equal(await checkCodexLogin({ env: {}, spawn }), true)
    assert.deepEqual(calls, [
      { command: 'codex', args: ['login', 'status'], stdio: ['ignore', 'ignore', 'pipe'] },
    ])
  })

  it('resolves false on a non-zero exit', async () => {
    const { spawn } = fakeSpawn({ code: 1 })
    assert.equal(await checkCodexLogin({ env: {}, spawn }), false)
  })

  it('resolves false when the binary is missing', async () => {
    const { spawn } = fakeSpawn({ error: new Error('spawn codex ENOENT') })
    assert.equal(await checkCodexLogin({ env: {}, spawn }), false)
  })

  it('honours CODEX_PATH', async () => {
    const { calls, spawn } = fakeSpawn({ code: 0 })
    await checkCodexLogin({ env: { CODEX_PATH: '/opt/bin/codex' }, spawn })
    assert.equal(calls[0].command, '/opt/bin/codex')
  })
})

describe('ensureManagedCodexHome', () => {
  it('writes a config that neutralises the operator config', () => {
    const managed = tempDir()
    const dir = ensureManagedCodexHome({
      CODEX_HOME: tempDir(),
      CODEX_REASONING_EFFORT: 'high',
      DATUM_CODEX_HOME: managed,
    })
    assert.equal(dir, managed)
    const config = fs.readFileSync(path.join(managed, 'config.toml'), 'utf8').trim().split('\n')
    assert.deepEqual(config, [
      'model_reasoning_effort = "high"',
      'web_search = "disabled"',
      'notify = []',
      'project_doc_max_bytes = 0',
    ])
  })

  it('defaults the reasoning effort to medium', () => {
    const managed = tempDir()
    ensureManagedCodexHome({ CODEX_HOME: tempDir(), DATUM_CODEX_HOME: managed })
    const config = fs.readFileSync(path.join(managed, 'config.toml'), 'utf8')
    assert.match(config, /^model_reasoning_effort = "medium"$/m)
  })

  it('omits the auth symlink when the operator has no login', () => {
    const managed = tempDir()
    ensureManagedCodexHome({ CODEX_HOME: tempDir(), DATUM_CODEX_HOME: managed })
    assert.deepEqual(fs.readdirSync(managed), ['config.toml'])
  })

  it('symlinks the operator auth file and converges when called again', () => {
    const home = tempDir()
    const managed = tempDir()
    const source = path.join(home, 'auth.json')
    fs.writeFileSync(source, '{}')

    const env = { CODEX_HOME: home, DATUM_CODEX_HOME: managed }
    ensureManagedCodexHome(env)
    ensureManagedCodexHome(env)

    const link = path.join(managed, 'auth.json')
    assert.equal(fs.lstatSync(link).isSymbolicLink(), true)
    assert.equal(fs.readlinkSync(link), source)
  })

  it('creates the managed directory when it does not exist', () => {
    const managed = path.join(tempDir(), 'nested', 'home')
    assert.equal(ensureManagedCodexHome({ CODEX_HOME: tempDir(), DATUM_CODEX_HOME: managed }), managed)
    assert.equal(fs.existsSync(path.join(managed, 'config.toml')), true)
  })
})

describe('ensureManagedCodexHome relinking', () => {
  it('repoints a symlink left over from a different CODEX_HOME', () => {
    const managed = tempDir()
    const first = tempDir()
    const second = tempDir()
    fs.writeFileSync(path.join(first, 'auth.json'), '{}')
    fs.writeFileSync(path.join(second, 'auth.json'), '{}')

    ensureManagedCodexHome({ CODEX_HOME: first, DATUM_CODEX_HOME: managed })
    ensureManagedCodexHome({ CODEX_HOME: second, DATUM_CODEX_HOME: managed })

    assert.equal(
      fs.readlinkSync(path.join(managed, 'auth.json')),
      path.join(second, 'auth.json'),
    )
  })

  it('never replaces a real file an operator put there', () => {
    const home = tempDir()
    const managed = tempDir()
    fs.writeFileSync(path.join(home, 'auth.json'), '{}')
    fs.writeFileSync(path.join(managed, 'auth.json'), 'operator-owned')

    ensureManagedCodexHome({ CODEX_HOME: home, DATUM_CODEX_HOME: managed })

    assert.equal(fs.readFileSync(path.join(managed, 'auth.json'), 'utf8'), 'operator-owned')
  })
})
