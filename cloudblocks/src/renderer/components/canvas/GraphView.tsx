import { useMemo } from 'react'
import { ReactFlow, Background, MiniMap, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { ResourceNode } from './nodes/ResourceNode'
import type { CloudNode } from '../../types/cloud'

const NODE_TYPES = { resource: ResourceNode }

// Derives edges from CloudNode parentId relationships and cross-service links
function deriveEdges(nodes: CloudNode[]): Edge[] {
  return nodes
    .filter((n) => n.parentId)
    .map((n) => ({
      id:     `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      type:   'step',   // orthogonal 90° pipe routing
      style:  { stroke: '#333', strokeWidth: 1.5 },
    }))
}

interface GraphViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function GraphView({ onNodeContextMenu }: GraphViewProps): JSX.Element {
  const cloudNodes   = useCloudStore((s) => s.nodes)
  const pendingNodes = useCloudStore((s) => s.pendingNodes)
  const selectNode = useCloudStore((s) => s.selectNode)
  const selectedId = useCloudStore((s) => s.selectedNodeId)

  const allNodes = useMemo(() => [...cloudNodes, ...pendingNodes], [cloudNodes, pendingNodes])

  const flowNodes: Node[] = useMemo(
    () =>
      allNodes.map((n, i) => ({
        id:       n.id,
        type:     'resource',
        position: { x: (i % 5) * 160 + 40, y: Math.floor(i / 5) * 100 + 60 }, // initial grid layout
        data:     { label: n.label, nodeType: n.type, status: n.status },
        selected: n.id === selectedId,
      })),
    [allNodes, selectedId],
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
