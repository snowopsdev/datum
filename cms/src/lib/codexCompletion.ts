/**
 * Legacy Codex completion boundary. Local agents cannot safely process
 * application content with host authority, so live calls always fail closed.
 * Tests inject completions at the CMS or pipeline caller instead.
 */
export interface CodexTextRequest {
  system: string
  user: string
  /** Legacy prefixed model id (`codex/…`). */
  model: string
  needWebSearch?: boolean
  signal?: AbortSignal
}

export interface CodexTextResult {
  text: string
  usage: { inputTokens: number; outputTokens: number; webSearchRequests: number }
  model: string
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

export async function completeTextViaCodex(_req: CodexTextRequest): Promise<CodexTextResult> {
  throw new CodexLocalExecutionDisabledError()
}
