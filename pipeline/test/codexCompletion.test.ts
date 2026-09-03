import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerHooks } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { pathToFileURL } from 'node:url'

import {
  CodexLocalExecutionDisabledError,
  CodexNotLoggedInError,
  type CodexRunner,
  type CodexThreadOptions,
  type CodexTurn,
  completeTextViaCodex,
} from '../src/codexCompletion'

const tempDirs: string[] = []

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-completion-test-'))
  tempDirs.push(dir)
  return dir
}

after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { force: true, recursive: true })
})

const request = { system: 'SYS', user: 'USR', model: 'codex/gpt-5.6-terra' }

function completedTurn(overrides: Partial<CodexTurn> = {}): CodexTurn {
  return { finalResponse: 'reply', items: [], usage: null, ...overrides }
}

type RunCall = { options: CodexThreadOptions; prompt: string; signal?: AbortSignal }

function fakeRunner(outcome: CodexTurn | { throws: Error }) {
  const calls: RunCall[] = []
  const runner: CodexRunner = {
    startThread: (options) => ({
      run: async (prompt, turnOptions) => {
        calls.push({ options, prompt, signal: turnOptions?.signal })
        if ('throws' in outcome) throw outcome.throws
        return outcome
      },
    }),
  }
  return { calls, runner }
}

describe('completeTextViaCodex prompt', () => {
  it('sends the system and user turns joined by a blank line, with nothing appended', async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: {}, runner })
    assert.equal(calls[0].prompt, 'SYS\n\nUSR')
  })
})

describe('completeTextViaCodex model id', () => {
  it('gives the SDK the bare id and returns the prefixed one', async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    const result = await completeTextViaCodex(request, { env: {}, runner })
    assert.equal(calls[0].options.model, 'gpt-5.6-terra')
    assert.equal(result.model, 'codex/gpt-5.6-terra')
  })
})

describe('completeTextViaCodex thread options', () => {
  it('sandboxes the turn and never asks for approval', async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: {}, runner })
    const { approvalPolicy, sandboxMode, skipGitRepoCheck } = calls[0].options
    assert.deepEqual(
      { approvalPolicy, sandboxMode, skipGitRepoCheck },
      { approvalPolicy: 'never', sandboxMode: 'read-only', skipGitRepoCheck: true },
    )
  })

  it('disables web search unless the stage asked for it', async () => {
    const off = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: {}, runner: off.runner })
    assert.equal(off.calls[0].options.webSearchMode, 'disabled')
    assert.equal(off.calls[0].options.networkAccessEnabled, false)

    const on = fakeRunner(completedTurn())
    await completeTextViaCodex({ ...request, needWebSearch: true }, { env: {}, runner: on.runner })
    assert.equal(on.calls[0].options.webSearchMode, 'live')
    assert.equal(on.calls[0].options.networkAccessEnabled, true)
  })
})

describe('completeTextViaCodex usage', () => {
  it('maps the snake_case token counts', async () => {
    const { runner } = fakeRunner(
      completedTurn({ usage: { input_tokens: 15_767, output_tokens: 42 } }),
    )
    const result = await completeTextViaCodex(request, { env: {}, runner })
    assert.deepEqual(result.usage, { inputTokens: 15_767, outputTokens: 42, webSearchRequests: 0 })
    assert.equal(result.text, 'reply')
  })

  it('reports zeros when the turn carried no usage', async () => {
    const { runner } = fakeRunner(completedTurn({ usage: null }))
    const result = await completeTextViaCodex(request, { env: {}, runner })
    assert.deepEqual(result.usage, { inputTokens: 0, outputTokens: 0, webSearchRequests: 0 })
  })

  it('counts web searches and ignores the error item a successful turn carries', async () => {
    const { runner } = fakeRunner(
      completedTurn({
        items: [
          { type: 'web_search' },
          { type: 'error' },
          { type: 'agent_message' },
          { type: 'web_search' },
        ],
      }),
    )
    const result = await completeTextViaCodex(request, { env: {}, runner })
    assert.equal(result.usage.webSearchRequests, 2)
    assert.equal(result.text, 'reply')
  })
})

describe('completeTextViaCodex failures', () => {
  it('rejects a turn that produced no agent message', async () => {
    const { runner } = fakeRunner(completedTurn({ finalResponse: '' }))
    await assert.rejects(completeTextViaCodex(request, { env: {}, runner }), /no agent message/)
  })

  it('turns a logged-out failure into CodexNotLoggedInError carrying the hint', async () => {
    const { runner } = fakeRunner({ throws: new Error('stream error: 401 Unauthorized') })
    await assert.rejects(completeTextViaCodex(request, { env: {}, runner }), (error: Error) => {
      assert.ok(error instanceof CodexNotLoggedInError)
      assert.match(error.message, /codex login/)
      return true
    })
  })

  it('prefixes any other failure and leaves it a plain Error', async () => {
    const { runner } = fakeRunner({ throws: new Error('Codex Exec exited with 1: boom') })
    await assert.rejects(completeTextViaCodex(request, { env: {}, runner }), (error: Error) => {
      assert.equal(error instanceof CodexNotLoggedInError, false)
      assert.equal(error.message, 'Codex: Codex Exec exited with 1: boom')
      return true
    })
  })
})

describe('completeTextViaCodex scratch directory', () => {
  it('removes the working directory after a completed turn', async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: {}, runner })
    assert.equal(fs.existsSync(calls[0].options.workingDirectory), false)
  })

  it('removes the working directory after a failed turn', async () => {
    const { calls, runner } = fakeRunner({ throws: new Error('boom') })
    await assert.rejects(completeTextViaCodex(request, { env: {}, runner }))
    assert.equal(fs.existsSync(calls[0].options.workingDirectory), false)
  })

  it('has the directory in place while the turn runs', async () => {
    let presentDuringRun: boolean | undefined
    const runner: CodexRunner = {
      startThread: (options) => ({
        run: async () => {
          presentDuringRun = fs.existsSync(options.workingDirectory)
          return completedTurn()
        },
      }),
    }
    await completeTextViaCodex(request, { env: {}, runner })
    assert.equal(presentDuringRun, true)
  })
})

describe('completeTextViaCodex environment', () => {
  it('takes the reasoning effort from CODEX_REASONING_EFFORT, defaulting to medium', async () => {
    const high = fakeRunner(completedTurn())
    const env = { CODEX_REASONING_EFFORT: 'high' }
    await completeTextViaCodex(request, { env, runner: high.runner })
    assert.equal(high.calls[0].options.modelReasoningEffort, 'high')

    const fallback = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: {}, runner: fallback.runner })
    assert.equal(fallback.calls[0].options.modelReasoningEffort, 'medium')
  })

  it('aborts the turn after CODEX_TIMEOUT_MS', async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    await completeTextViaCodex(request, { env: { CODEX_TIMEOUT_MS: '1' }, runner })
    const signal = calls[0].signal
    assert.ok(signal)
    await Promise.race([
      new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true })),
      new Promise((resolve) => setTimeout(resolve, 100)),
    ])
    assert.equal(signal.aborted, true)
  })

  it("passes the caller's own signal through untouched", async () => {
    const { calls, runner } = fakeRunner(completedTurn())
    const signal = AbortSignal.timeout(60_000)
    await completeTextViaCodex({ ...request, signal }, { env: {}, runner })
    assert.equal(calls[0].signal, signal)
  })
})

type StubSdkOptions = { codexPathOverride?: string; env: Record<string, string> }

/**
 * Stands a fake `@openai/codex-sdk` in front of the real one so the default
 * runner can be exercised without a binary, and records every module specifier
 * resolved while `run` is in flight.
 */
async function withResolvedSpecifiers(
  run: () => Promise<unknown>,
): Promise<{ sdkOptions: StubSdkOptions[]; specifiers: string[] }> {
  const sdkOptions: StubSdkOptions[] = []
  Object.assign(globalThis, { __codexSdkStub: sdkOptions })
  const stub = path.join(tempDir(), 'codex-sdk-stub.mjs')
  fs.writeFileSync(
    stub,
    [
      'export class Codex {',
      '  constructor(options) { globalThis.__codexSdkStub.push(options) }',
      '  startThread() {',
      '    return { run: async () => ({ items: [], finalResponse: "stub", usage: null }) }',
      '  }',
      '}',
      '',
    ].join('\n'),
  )

  const specifiers: string[] = []
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      specifiers.push(specifier)
      if (specifier === '@openai/codex-sdk') {
        return { shortCircuit: true, url: pathToFileURL(stub).href }
      }
      return nextResolve(specifier, context)
    },
  })
  try {
    await run()
  } finally {
    hooks.deregister()
  }
  return { sdkOptions, specifiers }
}

describe('completeTextViaCodex default runner', () => {
  it('fails closed before loading the SDK or exposing the host environment', async () => {
    const sourceHome = tempDir()
    const managedHome = path.join(tempDir(), 'managed')
    fs.writeFileSync(path.join(sourceHome, 'auth.json'), '{"sentinel":"reusable-login"}')
    const env = {
      DATABASE_URL: 'sentinel-database-secret',
      CODEX_PATH: '/opt/bin/codex',
      CODEX_HOME: sourceHome,
      DATUM_CODEX_HOME: managedHome,
    }
    const { sdkOptions, specifiers } = await withResolvedSpecifiers(async () => {
      await assert.rejects(completeTextViaCodex(request, { env }), (error: Error) => {
        assert.ok(error instanceof CodexLocalExecutionDisabledError)
        assert.match(error.message, /select an API-backed model instead/)
        return true
      })
    })
    assert.deepEqual(sdkOptions, [])
    assert.equal(specifiers.includes('@openai/codex-sdk'), false)
    assert.equal(fs.existsSync(managedHome), false)
  })

  it('never loads the SDK when a runner is injected', async () => {
    const { runner } = fakeRunner(completedTurn())
    const { specifiers } = await withResolvedSpecifiers(async () => {
      await completeTextViaCodex(request, { env: {}, runner })
      // Proves the recorder is live: a specifier resolved here does show up.
      await import('node:os')
    })
    assert.equal(specifiers.includes('node:os'), true)
    assert.equal(specifiers.includes('@openai/codex-sdk'), false)
  })
})
