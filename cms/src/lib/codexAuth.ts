/**
 * Locating and preflighting the operator's Codex CLI login. `auth.json` holds
 * live tokens, so nothing here ever reads or copies its contents.
 */
import { spawn as spawnProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

type Env = Record<string, string | undefined>

export const CODEX_LOGIN_HINT =
  'run `codex login` on this host (or `codex login --device-auth` on a headless machine)'

export function codexHome(env: Env = process.env): string {
  return env.CODEX_HOME || path.join(env.HOME ?? os.homedir(), '.codex')
}

export function codexAuthFilePresent(env: Env = process.env, exists = fs.existsSync): boolean {
  return exists(path.join(codexHome(env), 'auth.json'))
}

interface CodexProcess {
  on(event: 'close', listener: (code: number | null) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
}

type CodexSpawn = (
  command: string,
  args: string[],
  options: { stdio: ('ignore' | 'pipe')[] },
) => CodexProcess

/** Whether `codex login status` reports a usable login. Resolves false rather than rejecting. */
export function checkCodexLogin(deps: { env?: Env; spawn?: CodexSpawn } = {}): Promise<boolean> {
  const env = deps.env ?? process.env
  const spawn: CodexSpawn = deps.spawn ?? spawnProcess
  return new Promise((resolve) => {
    try {
      const child = spawn(env.CODEX_PATH || 'codex', ['login', 'status'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    } catch {
      resolve(false)
    }
  })
}

interface CodexHomeFs {
  existsSync: typeof fs.existsSync
  lstatSync: typeof fs.lstatSync
  mkdirSync: typeof fs.mkdirSync
  readlinkSync: typeof fs.readlinkSync
  symlinkSync: typeof fs.symlinkSync
  unlinkSync: typeof fs.unlinkSync
  writeFileSync: typeof fs.writeFileSync
}

/**
 * A private CODEX_HOME so the operator's own config never reaches a pipeline
 * call. `-c 'mcp_servers={}'` cannot do this: `-c` merges into the config table
 * instead of replacing it, so the operator's MCP servers still boot and spam
 * transport errors. Replacing the whole home is the only lever that isolates
 * config, and the symlink reuses the existing login without reading the token.
 */
export function ensureManagedCodexHome(env: Env = process.env, fsDeps: CodexHomeFs = fs): string {
  const dir = env.DATUM_CODEX_HOME || path.join(os.tmpdir(), 'datum-codex-home')
  fsDeps.mkdirSync(dir, { recursive: true })
  fsDeps.writeFileSync(
    path.join(dir, 'config.toml'),
    [
      `model_reasoning_effort = "${env.CODEX_REASONING_EFFORT || 'medium'}"`,
      'web_search = "disabled"',
      'notify = []',
      'project_doc_max_bytes = 0',
      '',
    ].join('\n'),
  )

  const authSource = path.join(codexHome(env), 'auth.json')
  const authLink = path.join(dir, 'auth.json')
  if (fsDeps.existsSync(authSource)) {
    try {
      fsDeps.symlinkSync(authSource, authLink)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      // A link left over from a different CODEX_HOME points at the wrong login,
      // so repoint it. Only ever a symlink: a real file here is the operator's.
      const existing = fsDeps.lstatSync(authLink)
      if (existing.isSymbolicLink() && fsDeps.readlinkSync(authLink) !== authSource) {
        fsDeps.unlinkSync(authLink)
        fsDeps.symlinkSync(authSource, authLink)
      }
    }
  }
  return dir
}
