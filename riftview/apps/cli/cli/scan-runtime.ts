// Real AWS-backed scan runner. Reuses the desktop plugin registry + awsPlugin
// via deep relative imports. Those modules are intentionally electron-free
// (see apps/desktop/src/main/plugin/awsPlugin.ts), so esbuild bundles them
// inline without pulling electron into the published CLI tarball. A future
// ticket can lift pluginRegistry + awsPlugin into @riftview/shared if the
// CLI grows additional cloud providers — tracked as a follow-up.
import { scanOnce } from '@riftview/shared'
import { pluginRegistry } from '../../desktop/src/main/plugin/registry'
import { awsPlugin } from '../../desktop/src/main/plugin/awsPlugin'
import type { ScanRunner } from './commands/scan'

let registered = false

function ensureRegistered(): void {
  if (registered) return
  pluginRegistry.register(awsPlugin)
  registered = true
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
