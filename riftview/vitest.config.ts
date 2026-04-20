import { defineConfig } from 'vitest/config'

// Monorepo root vitest config.
// Delegates to each workspace's vitest.config.ts via the `projects` field.
// See apps/desktop/vitest.config.ts for desktop test setup.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*']
  }
})
