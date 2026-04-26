import type { CloudNode } from '@riftview/shared'

/**
 * Tags each node with `metadata.standalone = true` if it has neither inbound
 * nor outbound integration edges. Mutates nodes in place; returns the same
 * array for chaining.
 *
 * A node is considered standalone when:
 *   - its own `integrations` array is empty, AND
 *   - no other node's `integrations[].targetId` references it
 *
 * Container types (vpc, subnet, security-group, region-zone) are never
 * marked standalone — they are structural, not operational. Note: the
 * `region-zone` and `global-zone` entries are renderer-side pseudo-types
 * that some scanners synthesise; they remain un-namespaced because they
 * are not part of any plugin's NodeType union.
 */
const CONTAINER_TYPES = new Set([
  'aws:vpc',
  'aws:subnet',
  'aws:security-group',
  'region-zone',
  'global-zone'
])

export function markStandaloneNodes(nodes: CloudNode[]): CloudNode[] {
  const referencedIds = new Set<string>()
  for (const node of nodes) {
    for (const edge of node.integrations ?? []) {
      referencedIds.add(edge.targetId)
    }
  }

  for (const node of nodes) {
    if (CONTAINER_TYPES.has(node.type)) continue
    const hasOutbound = (node.integrations ?? []).length > 0
    const hasInbound = referencedIds.has(node.id)
    const metadata = node.metadata ?? {}
    node.metadata = { ...metadata, standalone: !hasOutbound && !hasInbound }
  }

  return nodes
}
