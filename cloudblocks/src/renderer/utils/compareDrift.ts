import type { CloudNode } from '../types/cloud'

export interface DriftResult {
  matched:   string[]
  unmanaged: string[]
  missing:   string[]
}

export function compareDrift(
  liveNodes:     CloudNode[],
  importedNodes: CloudNode[],
): DriftResult {
  const eligible = importedNodes.filter((n) => n.type !== 'unknown')
  const liveIds  = new Set(liveNodes.map((n) => n.id))
  const impIds   = new Set(eligible.map((n) => n.id))

  const matched   = liveNodes.filter((n) => impIds.has(n.id)).map((n) => n.id)
  const unmanaged = liveNodes.filter((n) => !impIds.has(n.id)).map((n) => n.id)
  const missing   = eligible.filter((n) => !liveIds.has(n.id)).map((n) => n.id)

  return { matched, unmanaged, missing }
}

export function applyDriftToState(
  liveNodes:     CloudNode[],
  importedNodes: CloudNode[],
): { nodes: CloudNode[]; importedNodes: CloudNode[] } {
  const { matched, unmanaged, missing } = compareDrift(liveNodes, importedNodes)
  const matchedSet   = new Set(matched)
  const unmanagedSet = new Set(unmanaged)
  const missingSet   = new Set(missing)

  const importedMap = new Map(importedNodes.map((n) => [n.id, n]))

  const nodes = liveNodes.map((n) => {
    if (matchedSet.has(n.id)) {
      const imp = importedMap.get(n.id)!
      return { ...n, driftStatus: 'matched' as const, tfMetadata: imp.metadata }
    }
    if (unmanagedSet.has(n.id)) {
      return { ...n, driftStatus: 'unmanaged' as const }
    }
    return n
  })

  const newImportedNodes = importedNodes.map((n) => {
    if (n.type === 'unknown') return n  // exclude from drift, leave unchanged
    if (missingSet.has(n.id)) return { ...n, driftStatus: 'missing' as const }
    return n
  }).filter((n) => !matchedSet.has(n.id))  // remove matched ones (absorbed into live)

  return { nodes, importedNodes: newImportedNodes }
}
