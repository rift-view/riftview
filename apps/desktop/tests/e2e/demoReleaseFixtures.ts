import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from './electronApp'

// @release-mac fixture: launches the BUILT binary in demo mode — no
// LocalStack, no AWS. Used by the mac entry of the release matrix
// because GHA macos-latest runners can't run Docker (colima can't boot
// on macos-15 arm64). Exercises: built-binary launch, renderer boot,
// demo fixture seeding, Inspector click. Catches crash-level regressions
// and rendering breakage, which covers the bulk of mac-specific failure
// modes. Full LocalStack-backed coverage is Linux-only.

export interface DemoReleaseFixtures {
  app: ElectronApplication
  page: Page
}

export const test = base.extend<DemoReleaseFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture idiom: no upstream deps
  app: async ({}, use) => {
    const app = await launchApp({
      env: {
        RIFTVIEW_BUILT_APP: '1',
        RIFTVIEW_DEMO_MODE: '1'
      }
    })
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
