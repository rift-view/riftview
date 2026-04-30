import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
    // Playwright Electron E2E specs live under tests/e2e/ and are run by
    // `pnpm run test:e2e` (npx playwright test). Vitest must not collect them.
    // `deploy/` is the apps/desktop pnpm-deploy intermediate produced by
    // `pnpm run deploy` — it copies the source tree (including tests),
    // which would otherwise double the collected test count.
    exclude: ['**/node_modules/**', '**/dist/**', '**/deploy/**', 'tests/e2e/**']
  }
})
