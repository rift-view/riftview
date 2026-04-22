import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { launchApp } from './electronApp'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// @release-tier fixture: launches the BUILT binary against LocalStack.
//
// Strategy:
//   - HOME override points at a temp dir with a pre-seeded ~/.aws/credentials
//     file so listProfiles() (packages/shared/src/aws/credentials.ts reads
//     os.homedir()) finds an 'integration' profile with static test creds.
//   - AWS_ENDPOINT_URL is the AWS SDK v3 global override that routes all
//     clients through LocalStack regardless of profile.endpoint.
//   - RIFTVIEW_BUILT_APP=1 tells electronApp.ts to launch the electron-builder
//     --dir output instead of the dev entry.
//
// Pre-requisites (CI or local):
//   - LocalStack running on localhost:4566 (npm run localstack:up)
//   - Built binary present (cd apps/desktop && npx electron-builder --dir)

export interface ReleaseFixtures {
  app: ElectronApplication
  page: Page
  tempHome: string
}

export const test = base.extend<ReleaseFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture idiom: no upstream deps.
  tempHome: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'rv-release-home-'))
    const awsDir = join(dir, '.aws')
    mkdirSync(awsDir, { recursive: true })
    writeFileSync(
      join(awsDir, 'credentials'),
      ['[integration]', 'aws_access_key_id = test', 'aws_secret_access_key = test', ''].join('\n')
    )
    writeFileSync(
      join(awsDir, 'config'),
      ['[profile integration]', 'region = us-east-1', 'output = json', ''].join('\n')
    )
    try {
      await use(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  },
  app: async ({ tempHome }, use) => {
    const app = await launchApp({
      env: {
        HOME: tempHome,
        RIFTVIEW_BUILT_APP: '1',
        RIFTVIEW_E2E: '1',
        AWS_ENDPOINT_URL: 'http://localhost:4566',
        AWS_PROFILE: 'integration',
        AWS_REGION: 'us-east-1'
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
