import { expect } from 'vitest'
import type { NodeTypeMetadata, RiftViewPlugin } from '../types'

/**
 * Asserts that every entry in `plugin.nodeTypes` has a corresponding
 * entry in `plugin.nodeTypeMetadata`. Extracted from the original
 * inline assertion in `awsPlugin.test.ts` so every plugin's test file
 * gets the same coverage by calling one helper.
 *
 * Used by the per-plugin metadata-coverage tests (see RIFT-81 and Doc D
 * §"Testing contract"). Pair with `expectPluginNodeTypesInUnion` for the
 * cross-cutting alignment check that lives in
 * `plugin-union-alignment.test.ts`.
 */
export function expectNodeTypeMetadataAlignment(plugin: RiftViewPlugin): void {
  const missing: string[] = []
  for (const t of plugin.nodeTypes) {
    const meta = plugin.nodeTypeMetadata[t] as NodeTypeMetadata | undefined
    if (!meta) {
      missing.push(t)
      continue
    }
    expect(typeof meta.label, `meta.label for ${t}`).toBe('string')
    expect(typeof meta.borderColor, `meta.borderColor for ${t}`).toBe('string')
    expect(typeof meta.badgeColor, `meta.badgeColor for ${t}`).toBe('string')
    expect(typeof meta.shortLabel, `meta.shortLabel for ${t}`).toBe('string')
    expect(typeof meta.displayName, `meta.displayName for ${t}`).toBe('string')
    expect(typeof meta.hasCreate, `meta.hasCreate for ${t}`).toBe('boolean')
  }
  expect(missing, `nodeTypes without metadata entries`).toEqual([])
}

/**
 * Asserts that every entry in `plugin.nodeTypes` is also a member of the
 * canonical `NODE_TYPES` union from `@riftview/shared`. Closes the
 * loophole that `nodeTypes` is typed as `readonly string[]` on the
 * plugin interface — without this check, a plugin could declare a node
 * type the renderer's `Record<NodeType, ...>` maps have no entry for.
 *
 * Pass `validNodeTypes` as a `Set` so the caller can build it once and
 * share it across many plugin checks.
 */
export function expectPluginNodeTypesInUnion(
  plugin: RiftViewPlugin,
  validNodeTypes: ReadonlySet<string>
): void {
  const unknown = plugin.nodeTypes.filter((nt) => !validNodeTypes.has(nt))
  expect(
    unknown,
    `plugin "${plugin.id}" declares nodeTypes not present in NODE_TYPES union`
  ).toEqual([])
}
