import { defineConfig } from 'vitest/config'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// LocalStack-backed integration tests for the CLI. Runs the built
// bundle at apps/cli/out/index.js as a subprocess against LocalStack
// (started via `npm run localstack:up`). Excluded from root `npm test`
// by virtue of being a separate config file — only invoked via
// `npm run test:integration` and by the `e2e` CI job.
//
// `root` pins the include resolution to this file's directory
// (apps/cli) so `vitest run --config apps/cli/vitest.integration.config.ts`
// from the repo root picks up tests under apps/cli/tests/integration/.
const HERE = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: HERE,
  test: {
    name: 'cli-integration',
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    // Integration tests exec a subprocess per case — be generous.
    testTimeout: 30_000
  }
})
