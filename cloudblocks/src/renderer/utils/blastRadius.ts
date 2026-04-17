import type { CloudNode } from '../types/cloud'

export interface BlastRadiusNode {
  nodeId: string
  hopDistance: number // 0 = source, 1 = direct neighbor, 2 = 2 hops, etc.
  direction: 'source' | 'upstream' | 'downstream' | 'both'
  edgeTypes: string[] // edge types connecting to source path
}

export interface BlastRadiusResult {
  members: Map<string, BlastRadiusNode> // nodeId → BlastRadiusNode
  upstreamCount: number
  downstreamCount: number
  maxHops: number
}

const HOP_LIMIT = 6

export function buildBlastRadius(nodes: CloudNode[], sourceId: string): BlastRadiusResult {
  // Build adjacency maps from node.integrations
  const outboundMap = new Map<string, { targetId: string; edgeType: string }[]>()
  const inboundMap = new Map<string, { sourceId: string; edgeType: string }[]>()

  for (const node of nodes) {
    for (const { targetId, edgeType } of node.integrations ?? []) {
      // outbound: node.id → target
      if (!outboundMap.has(node.id)) outboundMap.set(node.id, [])
      outboundMap.get(node.id)!.push({ targetId, edgeType })

      // inbound: target ← node.id
      if (!inboundMap.has(targetId)) inboundMap.set(targetId, [])
      inboundMap.get(targetId)!.push({ sourceId: node.id, edgeType })
    }
  }

  // members accumulates hop/direction/edgeTypes per node
  const members = new Map<string, BlastRadiusNode>()

  // Forward BFS — downstream
  const downVisited = new Set<string>()
  const downQueue: { nodeId: string; hop: number }[] = [{ nodeId: sourceId, hop: 0 }]
  while (downQueue.length > 0) {
    const { nodeId, hop } = downQueue.shift()!
    if (downVisited.has(nodeId)) continue
    downVisited.add(nodeId)

    const existing = members.get(nodeId)
    if (!existing) {
      members.set(nodeId, {
        nodeId,
        hopDistance: hop,
        direction: hop === 0 ? 'source' : 'downstream',
        edgeTypes: []
      })
    } else if (hop < existing.hopDistance) {
      existing.hopDistance = hop
    }

    if (hop >= HOP_LIMIT) continue
    for (const { targetId, edgeType } of outboundMap.get(nodeId) ?? []) {
      if (!downVisited.has(targetId)) {
        downQueue.push({ nodeId: targetId, hop: hop + 1 })
        // Eagerly populate edgeTypes if member already registered
        const existing2 = members.get(targetId)
        if (existing2 && !existing2.edgeTypes.includes(edgeType)) {
          existing2.edgeTypes.push(edgeType)
        }
      }
    }
  }

  // Backward BFS — upstream
  const upVisited = new Set<string>()
  const upQueue: { nodeId: string; hop: number }[] = [{ nodeId: sourceId, hop: 0 }]
  while (upQueue.length > 0) {
    const { nodeId, hop } = upQueue.shift()!
    if (upVisited.has(nodeId)) {
      continue
    }
    upVisited.add(nodeId)

    if (hop > 0) {
      const existing = members.get(nodeId)
      if (!existing) {
        members.set(nodeId, {
          nodeId,
          hopDistance: hop,
          direction: 'upstream',
          edgeTypes: []
        })
      } else {
        // Already in downstream set — mark as 'both' (unless source)
        if (existing.direction === 'downstream') {
          existing.direction = 'both'
        }
        if (hop < existing.hopDistance) existing.hopDistance = hop
      }
    }

    if (hop >= HOP_LIMIT) continue
    for (const { sourceId: srcId, edgeType } of inboundMap.get(nodeId) ?? []) {
      if (!upVisited.has(srcId)) {
        upQueue.push({ nodeId: srcId, hop: hop + 1 })
        const existing2 = members.get(srcId)
        if (existing2 && !existing2.edgeTypes.includes(edgeType)) {
          existing2.edgeTypes.push(edgeType)
        }
      }
    }
  }

  // Counters
  let upstreamCount = 0
  let downstreamCount = 0
  let maxHops = 0

  for (const m of members.values()) {
    if (m.direction === 'upstream' || m.direction === 'both') upstreamCount++
    if (m.direction === 'downstream' || m.direction === 'both') downstreamCount++
    if (m.hopDistance > maxHops) maxHops = m.hopDistance
  }

  return { members, upstreamCount, downstreamCount, maxHops }
}

/** Returns the boxShadow style for a given hop distance */
export function hopRingStyle(hop: number): string {
  if (hop === 0) return '0 0 0 2px #FF9900'
  if (hop === 1) return '0 0 0 1.5px rgba(255,153,0,0.7)'
  if (hop === 2) return '0 0 0 1px rgba(255,153,0,0.4)'
  return '0 0 0 1px rgba(255,153,0,0.2)'
}

/** Direction badge symbol */
export function directionSymbol(direction: BlastRadiusNode['direction']): string {
  if (direction === 'source') return '●'
  if (direction === 'upstream') return '↑'
  if (direction === 'downstream') return '↓'
  return '↕'
}
