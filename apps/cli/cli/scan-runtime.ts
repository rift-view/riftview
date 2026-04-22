// Real AWS-backed scan runner. Uses @riftview/cloud-scan for the plugin
// registry and awsPlugin — those modules are electron-free, so esbuild
// bundles them inline without pulling electron into the published CLI tarball.
import { scanOnce } from '@riftview/shared'
import { pluginRegistry, registerBuiltinPlugins } from '@riftview/cloud-scan'
import type { ScanRunner } from './commands/scan'

function ensureRegistered(): void {
  registerBuiltinPlugins()
}

export const awsScanRunner: ScanRunner = async (input) => {
  ensureRegistered()
  return scanOnce({
    profile: input.profile,
    regions: input.regions,
    endpoint: input.endpoint,
    scanAll: (region) => pluginRegistry.scanAll(region),
    activate: (profile, regions, endpoint) => pluginRegistry.activateAll(profile, regions, endpoint)
  })
}
