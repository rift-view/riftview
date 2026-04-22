import { pluginRegistry } from './registry'
import { awsPlugin } from './awsPlugin'

let registered = false

/**
 * Idempotent registration of built-in cloud plugins. Safe to call
 * multiple times. Replaces the old import-triggered side effect in
 * the removed apps/desktop/src/main/plugin/index.ts.
 */
export function registerBuiltinPlugins(): void {
  if (registered) return
  pluginRegistry.register(awsPlugin)
  registered = true
}
