/** Login-presence checks for workspace readiness; never reads token contents. */
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
