import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execute = promisify(execFile)

// The child runs from the repo root, which declares no `tsx`: a bare `--import
// tsx` only resolved there through whatever copy another package happened to
// hoist. Resolve the one this workspace depends on instead.
const tsxLoader = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href

describe('pipeline report command', () => {
  it('prints stored results without requiring a live research target', async () => {
    const { stdout } = await execute(
      process.execPath,
      ['--import', tsxLoader, 'pipeline/src/index.ts', 'report', '--period', 'week'],
      {
        cwd: path.resolve(process.cwd(), '..'),
        timeout: 15_000,
        env: {
          ...process.env,
          MOCK_MODE: 'false',
          OPENAI_API_KEY: 'qa-fake-key',
          AHREFS_API_KEY: 'qa-fake-key',
          TARGET_DOMAIN: '',
          WEBHOOK_URL: '',
          WEBHOOK_SECRET: '',
        },
      },
    )
    expect(stdout).toContain('PIPELINE REPORT')
    expect(stdout).toContain('Failure digest')
    expect(stdout).not.toContain('[pipeline] workspace:')
    // Longer than the child's own 15 s limit, so a slow boot reports the
    // child's error and not Vitest's default 5 s timeout.
  }, 20_000)
})
