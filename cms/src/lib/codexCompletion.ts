/**
 * Shared Codex completion boundary. Production calls fail closed because a
 * local agent cannot safely process application content with host authority;
 * hermetic tests may inject a runner to exercise the response contract.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { CODEX_LOGIN_HINT } from './codexAuth'
import { codexModelId } from './llmProvider'

type Env = Record<string, string | undefined>

export interface CodexTextRequest {
  system: string
  user: string
  /** The prefixed id (`codex/…`); the prefix is stripped only at the SDK boundary. */
  model: string
  needWebSearch?: boolean
  signal?: AbortSignal
}

export interface CodexTextResult {
  text: string
  usage: { inputTokens: number; outputTokens: number; webSearchRequests: number }
  model: string
}

/** Mirrors the SDK's `ModelReasoningEffort`; a narrower list stays assignable to it. */
type CodexReasoningEffort =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max'
  | 'ultra'
  | 'persistent'

export interface CodexThreadOptions {
  model: string
  sandboxMode: 'read-only'
  workingDirectory: string
  skipGitRepoCheck: boolean
  approvalPolicy: 'never'
  webSearchMode: 'live' | 'disabled'
  networkAccessEnabled: boolean
  modelReasoningEffort: CodexReasoningEffort
}

export interface CodexTurn {
  items: { type: string }[]
  finalResponse: string
  usage: { input_tokens?: number; output_tokens?: number } | null
}

/** Structural stand-in for the SDK's `Codex`, which satisfies it; tests inject a fake. */
export interface CodexRunner {
  startThread(options: CodexThreadOptions): {
    run(input: string, turnOptions?: { signal?: AbortSignal }): Promise<CodexTurn>
  }
}

export class CodexNotLoggedInError extends Error {}

export class CodexLocalExecutionDisabledError extends Error {
  constructor() {
    super(
      'Local Codex execution is disabled for application content because it cannot isolate ' +
        'the agent from host credentials and files; select an API-backed model instead',
    )
    this.name = 'CodexLocalExecutionDisabledError'
  }
}

const DEFAULT_TIMEOUT_MS = 600_000

const LOGGED_OUT = /not logged in|logged out|unauthori[sz]ed|401|refresh token/i

export async function completeTextViaCodex(
  req: CodexTextRequest,
  deps: { runner?: CodexRunner; env?: Env } = {},
): Promise<CodexTextResult> {
  // Application prompts contain authenticated notes, uploads, article text,
  // research, and crawled pages. A local Codex agent can read beyond its empty
  // working directory (including its reusable login), so read-only mode and an
  // environment allowlist cannot form a safe boundary. Keep runner injection
  // solely as a hermetic test seam; production callers never supply one.
  if (!deps.runner) throw new CodexLocalExecutionDisabledError()

  const env = deps.env ?? process.env
  const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'datum-codex-'))
  try {
    const turn = await runTurn(req, env, workingDirectory, deps.runner)
    if (!turn.finalResponse) throw new Error('Codex returned no agent message')
    return {
      text: turn.finalResponse,
      usage: {
        inputTokens: turn.usage?.input_tokens ?? 0,
        outputTokens: turn.usage?.output_tokens ?? 0,
        webSearchRequests: turn.items.filter((item) => item.type === 'web_search').length,
      },
      model: req.model,
    }
  } finally {
    try {
      fs.rmSync(workingDirectory, { force: true, recursive: true })
    } catch {
      // A stranded scratch directory must never mask the turn's own outcome.
    }
  }
}

async function runTurn(
  req: CodexTextRequest,
  env: Env,
  workingDirectory: string,
  injected: CodexRunner,
): Promise<CodexTurn> {
  try {
    const thread = injected.startThread({
      model: codexModelId(req.model),
      sandboxMode: 'read-only',
      workingDirectory,
      skipGitRepoCheck: true,
      approvalPolicy: 'never',
      // Always stated: an unset search mode inherits the operator's config.
      webSearchMode: req.needWebSearch ? 'live' : 'disabled',
      networkAccessEnabled: Boolean(req.needWebSearch),
      // Passed through unvalidated, as `ensureManagedCodexHome` does: the CLI
      // rejects an unknown effort with a better message than a guess would.
      modelReasoningEffort: (env.CODEX_REASONING_EFFORT || 'medium') as CodexReasoningEffort,
    })
    // Whether `run()` resolves or throws is the only success signal: an `error`
    // item rides along even on fully successful turns.
    return await thread.run(`${req.system}\n\n${req.user}`, {
      signal: req.signal ?? AbortSignal.timeout(Number(env.CODEX_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (LOGGED_OUT.test(message)) {
      throw new CodexNotLoggedInError(`Codex: ${message} — ${CODEX_LOGIN_HINT}`)
    }
    throw new Error(`Codex: ${message}`)
  }
}
