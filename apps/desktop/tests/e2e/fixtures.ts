import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, type LaunchOptions } from './electronApp'

// Playwright fixture — boots Electron, exposes firstWindow() as `page`,
// tears down after each test. Use `demoMode: true` in test.use() to
// launch with VITE_DEMO_MODE=1 and the fixture store seeded.
export interface AppFixtures {
  app: ElectronApplication
  page: Page
  launchOptions: LaunchOptions
}

export const test = base.extend<AppFixtures>({
  launchOptions: [{}, { option: true }],
  app: async ({ launchOptions }, use) => {
    const app = await launchApp(launchOptions)
    try {
      await use(app)
    } finally {
      await app.close()
    }
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await use(page)
  }
})

export { expect } from '@playwright/test'
