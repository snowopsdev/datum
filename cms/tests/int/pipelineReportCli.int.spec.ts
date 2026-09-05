import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execute = promisify(execFile)

describe('pipeline report command', () => {
  it('prints stored results without requiring a live research target', async () => {
    const { stdout } = await execute(
      process.execPath,
      ['--import', 'tsx', 'pipeline/src/index.ts', 'report', '--period', 'week'],
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
  })
})
