import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { resolveWorkspaceProfile } from '../../cms/src/lib/tenant'
import { runModeFromEnv, runModeProblem } from '../../cms/src/lib/runMode'
import { evaluateRuntimeReadiness, modeFromEnv } from '../../cms/src/lib/workspaceReadiness'

const pipelineDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type Env = Record<string, string | undefined>

describe('runModeFromEnv', () => {
  const table: [Env, 'mock' | 'live'][] = [
    [{ MOCK_MODE: 'true' }, 'mock'],
    [{ MOCK_MODE: 'TRUE' }, 'mock'],
    [{ MOCK_MODE: '1' }, 'mock'],
    [{ MOCK_MODE: 'yes' }, 'mock'],
    [{ MOCK_MODE: 'true', ANTHROPIC_API_KEY: 'k' }, 'mock'],
    [{ MOCK_MODE: 'false' }, 'live'],
    [{ MOCK_MODE: '0' }, 'live'],
    [{ MOCK_MODE: 'No' }, 'live'],
    // false with no key is live: the per-stage key check refuses the run.
    [{ MOCK_MODE: 'false' }, 'live'],
    [{}, 'mock'],
    [{ MOCK_MODE: '' }, 'mock'],
    [{ MOCK_MODE: '   ' }, 'mock'],
    [{ ANTHROPIC_API_KEY: 'k' }, 'live'],
    [{ OPENAI_API_KEY: 'k' }, 'live'],
    [{ MOCK_MODE: '', OPENAI_API_KEY: 'k' }, 'live'],
    [{ ANTHROPIC_API_KEY: '  ', OPENAI_API_KEY: '' }, 'mock'],
    [{ SOME_OTHER_CREDENTIAL: 'x' }, 'mock'],
    // Unparseable: mock, with or without a key.
    [{ MOCK_MODE: 'maybe' }, 'mock'],
    [{ MOCK_MODE: 'maybe', ANTHROPIC_API_KEY: 'k' }, 'mock'],
    [{ MOCK_MODE: 'truee', OPENAI_API_KEY: 'k' }, 'mock'],
  ]
  for (const [env, expected] of table) {
    it(`${JSON.stringify(env)} -> ${expected}`, () => {
      assert.equal(runModeFromEnv(env), expected)
      assert.equal(modeFromEnv(env), expected)
    })
  }

  it('reports only an unrecognised value as a problem', () => {
    for (const env of [{}, { MOCK_MODE: '' }, { MOCK_MODE: 'true' }, { MOCK_MODE: 'No' }]) {
      assert.equal(runModeProblem(env), undefined)
    }
    assert.equal(
      runModeProblem({ MOCK_MODE: ' tru ' }),
      'MOCK_MODE has an unrecognised value: "tru". Treated as mock mode until it is set to true or false',
    )
  })
})

describe('readiness reports an unrecognised MOCK_MODE', () => {
  const run = (env: Env) =>
    evaluateRuntimeReadiness({
      env,
      models: {},
      profile: resolveWorkspaceProfile(null, env, { mockDefault: modeFromEnv(env) === 'mock' }),
    })

  it('as a runtime problem, in mock mode, so the operator sees it', () => {
    const readiness = run({ MOCK_MODE: 'flase', ANTHROPIC_API_KEY: 'k' })
    assert.equal(readiness.mode, 'mock')
    assert.equal(readiness.runtime.ready, false)
    assert.ok(
      readiness.runtime.problems.some((p) => p.startsWith('MOCK_MODE has an unrecognised value: "flase"')),
    )
  })

  it('and says nothing for a valid value', () => {
    assert.deepEqual(run({ MOCK_MODE: 'true' }).runtime.problems, [])
  })
})

describe('pipeline config at import', () => {
  const importConfig = (env: Env) => {
    // A fresh process: `config` is built when the module first loads.
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        "import('./src/config.ts').then((m) => console.log('MODE=' + m.config.mockMode))",
      ],
      { cwd: pipelineDir, env: { NODE_ENV: 'test', PATH: process.env.PATH, ...env }, encoding: 'utf8' },
    )
    return { status: result.status, out: result.stdout, err: result.stderr }
  }

  it('does not throw for MOCK_MODE=false with no provider key (live; models.ts refuses the run)', () => {
    const { status, out, err } = importConfig({ MOCK_MODE: 'false' })
    assert.equal(status, 0, err)
    assert.match(out, /MODE=false/)
  })

  it('does not throw for an unparseable MOCK_MODE and runs mock', () => {
    const { status, out, err } = importConfig({ MOCK_MODE: 'sometimes', ANTHROPIC_API_KEY: 'k' })
    assert.equal(status, 0, err)
    assert.match(out, /MODE=true/)
  })
})
