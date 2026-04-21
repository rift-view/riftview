import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp, type LaunchOptions } from './electronApp'

// Playwright fixture — boots Electron, exposes firstWindow() as `page`,
// tears down after each test. Use `appLaunchOptions: { demoMode: true }`
// in test.use() to launch with RIFTVIEW_DEMO_MODE=1 and the fixture store seeded.
// (Name is `appLaunchOptions` to avoid collision with Playwright's builtin
// worker-scoped `launchOptions` fixture.)
export interface AppFixtures {
  app: ElectronApplication
  page: Page
  appLaunchOptions: LaunchOptions
}

export const test = base.extend<AppFixtures>({
  appLaunchOptions: [{}, { option: true }],
  app: async ({ appLaunchOptions }, use) => {
    const app = await launchApp(appLaunchOptions)
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
