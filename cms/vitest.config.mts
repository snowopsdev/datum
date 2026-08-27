import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Database-backed suites share one Postgres schema. Payload pushes that
    // schema during getPayload(), so running those files concurrently races
    // duplicate enum and index creation on a fresh database.
    fileParallelism: false,
  },
})
