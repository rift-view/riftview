import { useMemo } from 'react'
import { ReactFlow, Background, MiniMap, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { ResourceNode } from './nodes/ResourceNode'
import { VpcNode } from './nodes/VpcNode'
import { SubnetNode } from './nodes/SubnetNode'
import type { CloudNode } from '../../types/cloud'

const NODE_TYPES = { resource: ResourceNode, vpc: VpcNode, subnet: SubnetNode }

const CONTAINER_TYPES = new Set(['vpc', 'subnet'])

// Lays out container nodes (VPCs, subnets) as parent nodes and
// resource nodes as children inside them.
function buildFlowNodes(cloudNodes: CloudNode[], selectedId: string | null): Node[] {
  const nodes: Node[] = []
  const containers = cloudNodes.filter((n) => CONTAINER_TYPES.has(n.type))
  const resources   = cloudNodes.filter((n) => !CONTAINER_TYPES.has(n.type))

  // Position VPCs as large containers
  containers
    .filter((n) => n.type === 'vpc')
    .forEach((vpc, i) => {
      nodes.push({
        id:       vpc.id,
        type:     'vpc',
        position: { x: 40 + i * 600, y: 40 },
        style:    { width: 560, height: 400 },
        data:     { label: vpc.label },
      })
    })

  // Position subnets inside their parent VPC
  const subnetsByVpc = new Map<string, CloudNode[]>()
  containers
    .filter((n) => n.type === 'subnet')
    .forEach((s) => {
      if (!s.parentId) return
      if (!subnetsByVpc.has(s.parentId)) subnetsByVpc.set(s.parentId, [])
      subnetsByVpc.get(s.parentId)!.push(s)
    })

  for (const [vpcId, subnets] of subnetsByVpc) {
    subnets.forEach((subnet, i) => {
      nodes.push({
        id:       subnet.id,
        type:     'subnet',
        parentId: vpcId,
        extent:   'parent',
        position: { x: 20 + i * 260, y: 40 },
        style:    { width: 240, height: 340 },
        data:     { label: subnet.label, isPublic: subnet.metadata.mapPublicIp },
      })
    })
  }

  // Position resources inside their parent subnet or vpc
  const resourcesByParent = new Map<string, CloudNode[]>()
  resources.forEach((r) => {
    const pid = r.parentId ?? '__root__'
    if (!resourcesByParent.has(pid)) resourcesByParent.set(pid, [])
    resourcesByParent.get(pid)!.push(r)
  })

  for (const [parentId, rNodes] of resourcesByParent) {
    if (parentId === '__root__') continue
    rNodes.forEach((r, i) => {
      nodes.push({
        id:       r.id,
        type:     'resource',
        parentId,
        extent:   'parent',
        position: { x: 20 + (i % 2) * 110, y: 30 + Math.floor(i / 2) * 60 },
        data:     { label: r.label, nodeType: r.type, status: r.status },
        selected: r.id === selectedId,
      })
    })
  }

  return nodes
}

interface TopologyViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function TopologyView({ onNodeContextMenu }: TopologyViewProps): JSX.Element {
  const cloudNodes   = useCloudStore((s) => s.nodes)
  const pendingNodes = useCloudStore((s) => s.pendingNodes)
  const selectNode = useCloudStore((s) => s.selectNode)
  const selectedId = useCloudStore((s) => s.selectedNodeId)

  const allNodes = useMemo(() => [...cloudNodes, ...pendingNodes], [cloudNodes, pendingNodes])

  const flowNodes: Node[] = useMemo(
    () => buildFlowNodes(allNodes, selectedId),
    [allNodes, selectedId],
  )

  const flowEdges: Edge[] = []  // Topology view uses nesting, not edges

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
