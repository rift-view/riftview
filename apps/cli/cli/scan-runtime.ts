// Real AWS-backed scan runner. Uses @riftview/cloud-scan for the plugin
// registry and awsPlugin. registerBuiltinPlugins() is idempotent, so calling
// it per-invocation is safe.
import { scanOnce } from '@riftview/shared'
import { pluginRegistry, registerBuiltinPlugins } from '@riftview/cloud-scan'
import type { ScanRunner } from './commands/scan'

export const awsScanRunner: ScanRunner = async (input) => {
  registerBuiltinPlugins()
  return scanOnce({
    profile: input.profile,
    regions: input.regions,
    endpoint: input.endpoint,
    scanAll: (region) => pluginRegistry.scanAll(region),
    activate: (profile, regions, endpoint) => pluginRegistry.activateAll(profile, regions, endpoint)
  })
}
