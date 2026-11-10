import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Most suites are database or pure-function tests. The component suites
    // opt into a DOM with a `// @vitest-environment jsdom` first line, so the
    // other files do not each pay for building one.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Database-backed suites share one migration-built Postgres database (dev
    // push is off under Vitest, see `payload.config.ts`) and several of them
    // rewrite the same globals and rows, so the files run one at a time.
    fileParallelism: false,
  },
})
