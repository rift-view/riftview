import { _electron as electron, type ElectronApplication } from 'playwright'
import { existsSync, readdirSync } from 'node:fs'
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
 * Honors RIFTVIEW_BUILT_APP=1 to launch the built binary (release artifact)
 * via executablePath. When unset, launches dev entry as today.
 */
export async function launchApp(opts: LaunchOptions = {}): Promise<ElectronApplication> {
  const repoRoot = resolve(__dirname, '..', '..', '..', '..')

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...(opts.demoMode ? { RIFTVIEW_DEMO_MODE: '1' } : {}),
    ...opts.env
  }

  // @release tier: launch the built binary (the artifact that publishes),
  // not the dev entry. Same specs run against both modes — only the
  // launch target changes. Platform-aware path: macOS (arm64/intel/universal),
  // Linux unpacked. Windows deferred per roadmap.
  if (process.env.RIFTVIEW_BUILT_APP === '1') {
    const executablePath = resolveBuiltBinary(repoRoot)
    return electron.launch({
      executablePath,
      env,
      timeout: 20_000
    })
  }

  const mainEntry = resolve(repoRoot, 'apps', 'desktop', 'out', 'main', 'index.js')
  return electron.launch({
    args: [mainEntry],
    env,
    timeout: 20_000
  })
}

function resolveBuiltBinary(repoRoot: string): string {
  const platform = process.platform
  if (platform === 'darwin') {
    const candidates = [
      'dist/mac-arm64/RiftView.app/Contents/MacOS/RiftView',
      'dist/mac-universal/RiftView.app/Contents/MacOS/RiftView',
      'dist/mac/RiftView.app/Contents/MacOS/RiftView'
    ]
    for (const rel of candidates) {
      const full = resolve(repoRoot, 'apps', 'desktop', rel)
      if (existsSync(full)) return full
    }
    throw new Error(
      `RIFTVIEW_BUILT_APP=1 but no mac binary found. Ran \`electron-builder --dir\`? Checked: ${candidates.join(', ')}`
    )
  }
  if (platform === 'linux') {
    const unpackedDir = resolve(repoRoot, 'apps', 'desktop', 'dist', 'linux-unpacked')
    if (!existsSync(unpackedDir)) {
      throw new Error(`RIFTVIEW_BUILT_APP=1 but no ${unpackedDir}. Ran \`electron-builder --dir\`?`)
    }
    // electron-builder picks the Linux executable name from
    // `linux.executableName` in electron-builder.yml (or derives it from
    // productName). Scan for an extensionless file rather than hardcoding
    // so we survive config renames.
    const entries = readdirSync(unpackedDir)
    const candidates = entries.filter((n) => !n.includes('.'))
    if (candidates.length === 0) {
      throw new Error(
        `No extensionless executable in ${unpackedDir}. Contents: ${entries.join(', ')}`
      )
    }
    return resolve(unpackedDir, candidates[0])
  }
  throw new Error(`RIFTVIEW_BUILT_APP=1 is not supported on platform: ${platform}`)
}
