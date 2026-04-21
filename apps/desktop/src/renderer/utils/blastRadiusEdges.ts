import type { BlastRadiusNode, BlastRadiusResult } from '@riftview/shared'

export function hopRingStyle(hop: number): string {
  if (hop === 0) return '0 0 0 2px #FF9900'
  if (hop === 1) return '0 0 0 1.5px rgba(255,153,0,0.7)'
  if (hop === 2) return '0 0 0 1px rgba(255,153,0,0.4)'
  return '0 0 0 1px rgba(255,153,0,0.2)'
}

export function directionSymbol(direction: BlastRadiusNode['direction']): string {
  if (direction === 'source') return '●'
  if (direction === 'upstream') return '↑'
  if (direction === 'downstream') return '↓'
  return '↕'
}

// Minimal edge shape the dimmer operates on — matches React Flow's Edge type
// structurally without importing it (keeps this util free of @xyflow/react).
interface DimmableEdge {
  source: string
  target: string
  animated?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: any
}

export function applyBlastRadiusToEdges<T extends DimmableEdge>(
  edges: T[],
  blastRadius: BlastRadiusResult | null
): T[] {
  if (!blastRadius) return edges
  return edges.map((e) => {
    const srcMember = blastRadius.members.has(e.source)
    const tgtMember = blastRadius.members.has(e.target)
    if (srcMember && tgtMember) {
      return {
        ...e,
        style: {
          ...(e.style ?? {}),
          strokeWidth: 2.5,
          opacity: 1
        }
      }
    }
    return {
      ...e,
      animated: false,
      style: {
        ...(e.style ?? {}),
        opacity: 0,
        pointerEvents: 'none' as const
      }
    }
  })
}
