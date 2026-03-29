import type { CloudNode, NodeType } from '../types/cloud'

const GRID_W = 150
const GRID_H = 66
const NODE_GAP_X = 20
const NODE_GAP_Y = 20
const GROUP_GAP_X = 60
const GROUP_GAP_Y = 60
const NODES_PER_ROW = 4
const MAX_ROW_WIDTH = 1400
const ORIGIN_X = 40
const ORIGIN_Y = 40

export function computeTidyLayout(
  nodes: CloudNode[],
  view: 'topology' | 'graph',
): Record<string, { x: number; y: number }> {
  if (view === 'graph') {
    // All nodes, grouped by type
    return groupedGrid(nodes)
  }
  // Topology: only top-level non-global nodes
  const topLevel = nodes.filter((n) => !n.parentId && n.region !== 'global')
  return groupedGrid(topLevel)
}

function groupedGrid(nodes: CloudNode[]): Record<string, { x: number; y: number }> {
  // Group by NodeType, sorted alphabetically for determinism
  const groups = new Map<NodeType, CloudNode[]>()
  for (const n of nodes) {
    if (!groups.has(n.type)) groups.set(n.type, [])
    groups.get(n.type)!.push(n)
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))

  const positions: Record<string, { x: number; y: number }> = {}
  let groupX = ORIGIN_X
  let rowY = ORIGIN_Y
  let rowMaxH = 0

  for (const [, groupNodes] of sorted) {
    const cols = Math.min(groupNodes.length, NODES_PER_ROW)
    const rows = Math.ceil(groupNodes.length / NODES_PER_ROW)
    const groupW = cols * (GRID_W + NODE_GAP_X) - NODE_GAP_X
    const groupH = rows * (GRID_H + NODE_GAP_Y) - NODE_GAP_Y

    if (groupX > ORIGIN_X && groupX + groupW > MAX_ROW_WIDTH) {
      groupX = ORIGIN_X
      rowY += rowMaxH + GROUP_GAP_Y
      rowMaxH = 0
    }

    groupNodes.forEach((n, i) => {
      positions[n.id] = {
        x: groupX + (i % NODES_PER_ROW) * (GRID_W + NODE_GAP_X),
        y: rowY + Math.floor(i / NODES_PER_ROW) * (GRID_H + NODE_GAP_Y),
      }
    })

    groupX += groupW + GROUP_GAP_X
    rowMaxH = Math.max(rowMaxH, groupH)
  }

  return positions
}
