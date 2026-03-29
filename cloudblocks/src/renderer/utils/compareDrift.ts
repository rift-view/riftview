import type { CloudNode } from '../types/cloud'

export interface DriftResult {
  matched:   string[]
  unmanaged: string[]
  missing:   string[]
  /** Maps live node ID → matched imported node ID (only populated for fuzzy matches) */
  fuzzyMap?: Map<string, string>
}

/** Normalise a label for fuzzy comparison: lowercase, collapse whitespace/separators */
function normLabel(s: string): string {
  return s.toLowerCase().replace(/[\s_\-./]+/g, '-').replace(/^-+|-+$/g, '')
}

export function compareDrift(
  liveNodes:     CloudNode[],
  importedNodes: CloudNode[],
): DriftResult {
  const eligible = importedNodes.filter((n) => n.type !== 'unknown')
  const liveIds  = new Set(liveNodes.map((n) => n.id))
  const impIds   = new Set(eligible.map((n) => n.id))

  // Pass 1 — exact ID match
  const exactMatchedLive = new Set(liveNodes.filter((n) => impIds.has(n.id)).map((n) => n.id))
  const exactMatchedImp  = new Set(eligible.filter((n) => liveIds.has(n.id)).map((n) => n.id))

  const unmatchedLive = liveNodes.filter((n) => !exactMatchedLive.has(n.id))
  const unmatchedImp  = eligible.filter((n) => !exactMatchedImp.has(n.id))

  // Pass 2 — fuzzy label match within same NodeType
  // Build a per-type map of normalised label → imported node for unmatched importeds
  const fuzzyMap = new Map<string, string>() // liveId → importedId
  const fuzzyMatchedImp = new Set<string>()

  const impByType = new Map<string, Map<string, CloudNode>>()
  for (const imp of unmatchedImp) {
    if (!impByType.has(imp.type)) impByType.set(imp.type, new Map())
    impByType.get(imp.type)!.set(normLabel(imp.label), imp)
  }

  const fuzzyMatchedLive = new Set<string>()
  for (const live of unmatchedLive) {
    const candidates = impByType.get(live.type)
    if (!candidates) continue
    const key = normLabel(live.label)
    const imp = candidates.get(key)
    if (imp && !fuzzyMatchedImp.has(imp.id)) {
      fuzzyMap.set(live.id, imp.id)
      fuzzyMatchedLive.add(live.id)
      fuzzyMatchedImp.add(imp.id)
    }
  }

  const matched   = [
    ...liveNodes.filter((n) => exactMatchedLive.has(n.id)).map((n) => n.id),
    ...unmatchedLive.filter((n) => fuzzyMatchedLive.has(n.id)).map((n) => n.id),
  ]
  const unmanaged = unmatchedLive.filter((n) => !fuzzyMatchedLive.has(n.id)).map((n) => n.id)
  const missing   = unmatchedImp.filter((n) => !fuzzyMatchedImp.has(n.id)).map((n) => n.id)

  return { matched, unmanaged, missing, fuzzyMap }
}

export function applyDriftToState(
  liveNodes:     CloudNode[],
  importedNodes: CloudNode[],
): { nodes: CloudNode[]; importedNodes: CloudNode[] } {
  const { matched, unmanaged, missing, fuzzyMap } = compareDrift(liveNodes, importedNodes)
  const matchedSet   = new Set(matched)
  const unmanagedSet = new Set(unmanaged)
  const missingSet   = new Set(missing)

  // Build import lookup by ID for exact matches, plus by fuzzy-mapped imported ID
  const importedMap = new Map(importedNodes.map((n) => [n.id, n]))
  // Also map fuzzy: live id → imported node
  const fuzzyImportedMap = new Map<string, CloudNode>()
  if (fuzzyMap) {
    for (const [liveId, impId] of fuzzyMap) {
      const imp = importedMap.get(impId)
      if (imp) fuzzyImportedMap.set(liveId, imp)
    }
  }

  const nodes = liveNodes.map((n) => {
    if (matchedSet.has(n.id)) {
      const imp = importedMap.get(n.id) ?? fuzzyImportedMap.get(n.id)!
      return { ...n, driftStatus: 'matched' as const, tfMetadata: imp.metadata }
    }
    if (unmanagedSet.has(n.id)) {
      return { ...n, driftStatus: 'unmanaged' as const }
    }
    return n
  })

  // Imported IDs consumed by any match (exact or fuzzy)
  const consumedImpIds = new Set([
    ...liveNodes.filter((n) => matchedSet.has(n.id) && importedMap.has(n.id)).map((n) => n.id),
    ...(fuzzyMap ? [...fuzzyMap.values()] : []),
  ])

  const newImportedNodes = importedNodes.map((n) => {
    if (n.type === 'unknown') return n
    if (missingSet.has(n.id)) return { ...n, driftStatus: 'missing' as const }
    return n
  }).filter((n) => !consumedImpIds.has(n.id))

  return { nodes, importedNodes: newImportedNodes }
}
