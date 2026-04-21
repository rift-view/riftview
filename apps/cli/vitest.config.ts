import { defineConfig } from 'vitest/config'

// Fast unit tests for the CLI workspace. Excludes tests/integration/**
// which requires Docker + LocalStack + a built bundle — those run under
// `apps/cli/vitest.integration.config.ts` via `npm run test:integration`.
// Root `npm test` discovers this config via workspace globs and picks
// only these unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**', 'out/**']
  }
})
