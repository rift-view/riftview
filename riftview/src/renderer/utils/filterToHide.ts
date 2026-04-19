import type { Edge } from '@xyflow/react'
import type { CloudNode } from '../types/cloud'
import type { NodeFilter } from '../store/ui'

/**
 * Returns only the nodes that pass at least one active filter.
 * If no filters are active, returns all nodes unchanged.
 */
export function applyNodeFilters(nodes: CloudNode[], filters: NodeFilter[]): CloudNode[] {
  if (filters.length === 0) return nodes
  return nodes.filter((n) => filters.some((f) => f.test(n)))
}

/**
 * Removes edges whose source or target is not in the visible node set.
 * Prevents React Flow from rendering orphaned edges when nodes are hidden.
 */
export function filterEdgesByVisibleNodes(edges: Edge[], visibleIds: Set<string>): Edge[] {
  return edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
}
