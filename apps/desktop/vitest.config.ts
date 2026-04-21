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
    // `npm run test:e2e` (npx playwright test). Vitest must not collect them.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**']
  }
})
