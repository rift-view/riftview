import { describe, it, expect, vi } from 'vitest'
import { NODE_TYPES } from '@riftview/shared'
import { PluginRegistry } from '../registry'
import { awsPlugin } from '../awsPlugin'
import { expectPluginNodeTypesInUnion } from './helpers'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

/**
 * Contract test (RIFT-81): every registered plugin's `nodeTypes` array
 * must be a subset of the canonical `NODE_TYPES` union exported from
 * `@riftview/shared`.
 *
 * Why this is needed:
 *   The plugin interface types `nodeTypes` as `readonly string[]` (see
 *   `plugin/types.ts`). Without this test, a plugin can declare e.g.
 *   `'hetzner:loadbalancer'` while the renderer's `Record<NodeType, ...>`
 *   maps have no matching entry, leaving such nodes in undefined-behavior
 *   territory at render time.
 *
 * What is and isn't covered:
 *   - Covered: `awsPlugin` (the only plugin currently registered via
 *     `boot.ts::registerBuiltinPlugins`).
 *   - NOT covered: `hetznerPlugin.stub.ts` and `vercelPlugin.stub.ts`.
 *     Those are typecheck-only stubs that intentionally use NodeTypes
 *     outside the union (the file headers say "NOT registered with the
 *     plugin registry; NOT imported from production code paths"). Their
 *     job is to prove the snapshot-export interface holds for non-AWS
 *     providers — including them here would (a) fail this test by design
 *     and (b) defeat the stubs' purpose. When a real Hetzner / Vercel
 *     plugin lands and its `nodeTypes` join `NODE_TYPES`, this test
 *     covers it automatically via the registry enumeration.
 *
 * Cross-reference: Doc D §"Decision 2 — Renderer decoupling strategy"
 * and §"Testing contract".
 */

// Build a fresh registry at module load so we can iterate plugins inside
// the `describe` block (beforeAll fires after collection, too late for
// `for (const plugin of plugins)` inside describe). Using a fresh
// `PluginRegistry` rather than the module-singleton avoids cross-suite
// state ordering pitfalls.
const registry = new PluginRegistry()
registry.register(awsPlugin)
const registeredPlugins = [...registry.plugins]
const validNodeTypes = new Set<string>(NODE_TYPES)

describe('plugin-union alignment', () => {
  it('registry enumerates at least one plugin', () => {
    expect(registeredPlugins.length).toBeGreaterThan(0)
  })

  it('NODE_TYPES set is non-empty', () => {
    expect(validNodeTypes.size).toBeGreaterThan(0)
  })

  // One assertion per plugin so failure messages identify the offender.
  for (const plugin of registeredPlugins) {
    it(`plugin "${plugin.id}" declares only nodeTypes that are members of NODE_TYPES`, () => {
      expectPluginNodeTypesInUnion(plugin, validNodeTypes)
    })
  }
})
