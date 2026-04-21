import { _electron as electron, type ElectronApplication } from 'playwright'
import { resolve } from 'node:path'

export interface LaunchOptions {
  /** Force demo mode + fixture seeding (used by demo-mode-scan.spec.ts). */
  demoMode?: boolean
  /** Override env for a specific test. Merged with process.env. */
  env?: NodeJS.ProcessEnv
}

/**
 * Launch the RiftView Electron app for E2E.
 *
 * M4: always launches the dev entry (electron-vite's bundled main.js at
 * apps/desktop/out/main/index.js after `npm run build --workspace=@riftview/desktop`).
 * M5: honours RIFTVIEW_BUILT_APP=1 to point at the built binary. Hook
 * stays in place but is a no-op in M4.
 */
export async function launchApp(opts: LaunchOptions = {}): Promise<ElectronApplication> {
  const repoRoot = resolve(__dirname, '..', '..', '..', '..')
  const mainEntry = resolve(repoRoot, 'apps', 'desktop', 'out', 'main', 'index.js')

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(opts.demoMode ? { RIFTVIEW_DEMO_MODE: '1' } : {}),
    ...opts.env
  }

  return electron.launch({
    args: [mainEntry],
    env,
    timeout: 20_000
  })
}
