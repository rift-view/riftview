import { defineConfig } from 'vitest/config'

// LocalStack-backed integration tests for the CLI. Runs the built
// bundle at apps/cli/out/index.js as a subprocess against LocalStack
// (started via `npm run localstack:up`). Excluded from root `npm test`
// by virtue of being a separate config file — only invoked via
// `npm run test:integration` and by the `e2e` CI job.
export default defineConfig({
  test: {
    name: 'cli-integration',
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    // Integration tests exec a subprocess per case — be generous.
    testTimeout: 30_000
  }
})
