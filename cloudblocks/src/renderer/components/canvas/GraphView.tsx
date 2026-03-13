import { useMemo } from 'react'
import { ReactFlow, Background, MiniMap, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { ResourceNode } from './nodes/ResourceNode'
import type { CloudNode } from '../../types/cloud'

const NODE_TYPES = { resource: ResourceNode }

// Distinct colors per VPC — cycles if more than 6 VPCs
const VPC_PALETTE = ['#1976D2', '#9c27b0', '#0891b2', '#16a34a', '#ea580c', '#e11d48']

// Walk up parentId chain to find the VPC ancestor (type === 'vpc')
function findVpcAncestor(node: CloudNode, byId: Map<string, CloudNode>): CloudNode | null {
  let current: CloudNode | undefined = node
  while (current) {
    if (current.type === 'vpc') return current
    if (!current.parentId) return null
    current = byId.get(current.parentId)
  }
  return null
}

function deriveEdges(nodes: CloudNode[]): Edge[] {
  return nodes
    .filter((n) => n.parentId)
    .map((n) => ({
      id:     `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      type:   'step',
      style:  { stroke: '#2a3a4a', strokeWidth: 1.5 },
    }))
}

interface GraphViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function GraphView({ onNodeContextMenu }: GraphViewProps){
  const cloudNodes   = useCloudStore((s) => s.nodes)
  const pendingNodes = useCloudStore((s) => s.pendingNodes)
  const selectNode   = useCloudStore((s) => s.selectNode)
  const selectedId   = useCloudStore((s) => s.selectedNodeId)

  const allNodes = useMemo(() => [...cloudNodes, ...pendingNodes], [cloudNodes, pendingNodes])

  // Build a quick lookup and a stable VPC → color assignment
  const byId = useMemo(() => new Map(allNodes.map((n) => [n.id, n])), [allNodes])

  const vpcColorMap = useMemo(() => {
    const map = new Map<string, string>()
    let idx = 0
    allNodes.forEach((n) => {
      if (n.type === 'vpc' && !map.has(n.id)) {
        map.set(n.id, VPC_PALETTE[idx % VPC_PALETTE.length])
        idx++
      }
    })
    return map
  }, [allNodes])

  const flowNodes: Node[] = useMemo(
    () => allNodes.map((n, i) => {
      const vpc      = findVpcAncestor(n, byId)
      const vpcColor = vpc ? (vpcColorMap.get(vpc.id) ?? undefined) : undefined
      const vpcLabel = vpc ? vpc.label : undefined

      return {
        id:       n.id,
        type:     'resource',
        position: { x: (i % 5) * 175 + 40, y: Math.floor(i / 5) * 110 + 60 },
        data:     {
          label:    n.label,
          nodeType: n.type,
          status:   n.status,
          // Only show VPC badge on non-VPC, non-subnet nodes to avoid redundancy
          vpcLabel: n.type !== 'vpc' && n.type !== 'subnet' ? vpcLabel : undefined,
          vpcColor: n.type !== 'vpc' && n.type !== 'subnet' ? vpcColor : undefined,
        },
        selected: n.id === selectedId,
      }
    }),
    [allNodes, selectedId, byId, vpcColorMap],
  )

  const flowEdges: Edge[] = useMemo(() => deriveEdges(allNodes), [allNodes])

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_e, node) => selectNode(node.id)}
      onPaneClick={() => selectNode(null)}
      onNodeContextMenu={(event, rfNode) => {
        event.preventDefault()
        const cloudNode = allNodes.find((n) => n.id === rfNode.id)
        if (cloudNode) onNodeContextMenu(cloudNode, event.clientX, event.clientY)
      }}
      fitView
      style={{ background: '#080c14' }}
    >
      <Background color="#1a1a2e" gap={20} />
      <MiniMap
        style={{ background: '#0d1320', border: '1px solid #1e2d40' }}
        nodeColor="#FF9900"
      />
    </ReactFlow>
  )
}
