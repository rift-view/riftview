import { defineConfig } from '@playwright/test'

// Electron's main-process state doesn't parallelise cleanly across workers —
// we'd either have to isolate per-worker app data or accept races. Single
// worker keeps tests readable; total PR-tier runtime stays under a minute.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['html', { outputFolder: 'tests/e2e/playwright-report' }], ['list']]
    : 'list',
  use: {
    trace: 'retain-on-failure'
  }
})
