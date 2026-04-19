import type { CloudNode } from '../types/cloud'
import { resolveIntegrationTargetId } from './resolveIntegrationTargetId'

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
  // Build adjacency maps from node.integrations.
  // Integration targetIds may be raw DNS names, ARNs, endpoint hostnames, etc.
  // They must be resolved against the node list so BFS member IDs match
  // the actual node IDs the canvas uses on edges.
  const outboundMap = new Map<string, { targetId: string; edgeType: string }[]>()
  const inboundMap = new Map<string, { sourceId: string; edgeType: string }[]>()

  for (const node of nodes) {
    for (const { targetId: rawTargetId, edgeType } of node.integrations ?? []) {
      const targetId = resolveIntegrationTargetId(nodes, rawTargetId)

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

/**
 * Minimal edge shape the dimmer operates on — matches React Flow's Edge type
 * structurally without importing it (keeps this util free of @xyflow/react).
 * `style` is typed loosely so both CSSProperties and React Flow's style
 * objects assign cleanly.
 */
interface DimmableEdge {
  source:    string
  target:    string
  animated?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?:    any
}

/**
 * Apply blast-radius styling to an edge list. Used by all three canvas views
 * (CommandView, GraphView, TopologyView) to avoid duplication.
 *
 * - Both endpoints are members → brighten + thicken while preserving the
 *   edge's native color, dash pattern, and animation (triggers stay amber
 *   dashed-animated, subscriptions stay teal, serves/origin stays solid
 *   indigo, user-drawn edges keep their user-chosen color).
 * - Either endpoint is NOT a member → dimmed (opacity 0, pointerEvents none)
 * - blastRadius null → edges returned unchanged
 */
export function applyBlastRadiusToEdges<T extends DimmableEdge>(
  edges:        T[],
  blastRadius:  BlastRadiusResult | null,
): T[] {
  if (!blastRadius) return edges
  return edges.map((e) => {
    const srcMember = blastRadius.members.has(e.source)
    const tgtMember = blastRadius.members.has(e.target)
    if (srcMember && tgtMember) {
      // Preserve edge-type-specific styling (color, dash, animation). Only
      // bump stroke width and force full opacity so the member path stands
      // out against the dimmed background.
      return {
        ...e,
        style: {
          ...(e.style ?? {}),
          strokeWidth: 2.5,
          opacity:     1,
        },
      }
    }
    return {
      ...e,
      animated: false,
      style: {
        ...(e.style ?? {}),
        opacity:       0,
        pointerEvents: 'none' as const,
      },
    }
  })
}
