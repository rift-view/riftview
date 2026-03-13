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

const RES_W     = 110
const RES_H     = 50
const RES_COLS  = 2
const RES_GAP_X = 10
const RES_GAP_Y = 10
const SUB_PAD_X = 16
const SUB_PAD_Y = 36  // space for subnet label
const SUB_GAP   = 16
const VPC_PAD   = 20
const VPC_GAP   = 40
const VPC_LABEL = 30  // space for VPC label at top

function subnetSize(resourceCount: number): { w: number; h: number } {
  const cols = Math.min(resourceCount || 1, RES_COLS)
  const rows = Math.max(1, Math.ceil(resourceCount / RES_COLS))
  return {
    w: Math.max(200, SUB_PAD_X * 2 + cols * RES_W + (cols - 1) * RES_GAP_X),
    h: Math.max(120, SUB_PAD_Y + rows * (RES_H + RES_GAP_Y) + RES_GAP_Y),
  }
}

// Lays out container nodes (VPCs, subnets) as parent nodes and
// resource nodes as children inside them. All sizes are computed
// from content so nothing overflows.
function buildFlowNodes(cloudNodes: CloudNode[], selectedId: string | null): Node[] {
  const nodes: Node[] = []

  // Bucket nodes by role
  const vpcs    = cloudNodes.filter((n) => n.type === 'vpc')
  const subnets = cloudNodes.filter((n) => n.type === 'subnet')
  const resources = cloudNodes.filter((n) => !CONTAINER_TYPES.has(n.type))

  const subnetsByVpc    = new Map<string, CloudNode[]>()
  const resourcesByParent = new Map<string, CloudNode[]>()
  const rootResources: CloudNode[] = []

  subnets.forEach((s) => {
    if (!s.parentId) return
    if (!subnetsByVpc.has(s.parentId)) subnetsByVpc.set(s.parentId, [])
    subnetsByVpc.get(s.parentId)!.push(s)
  })

  resources.forEach((r) => {
    if (!r.parentId) { rootResources.push(r); return }
    if (!resourcesByParent.has(r.parentId)) resourcesByParent.set(r.parentId, [])
    resourcesByParent.get(r.parentId)!.push(r)
  })

  // Place VPCs, sizing each one from its content
  let vpcX = 40
  vpcs.forEach((vpc) => {
    const vpcSubnets = subnetsByVpc.get(vpc.id) ?? []
    const subSizes   = vpcSubnets.map((s) => subnetSize((resourcesByParent.get(s.id) ?? []).length))
    const totalSubW  = subSizes.reduce((sum, s) => sum + s.w, 0) + Math.max(0, vpcSubnets.length - 1) * SUB_GAP
    const maxSubH    = subSizes.length > 0 ? Math.max(...subSizes.map((s) => s.h)) : 120
    const directRes  = resourcesByParent.get(vpc.id) ?? []
    const directSize = subnetSize(directRes.length)
    const vpcW = Math.max(260, VPC_PAD * 2 + Math.max(totalSubW, directRes.length > 0 ? directSize.w : 0))
    const vpcH = VPC_LABEL + VPC_PAD + maxSubH + VPC_PAD + (directRes.length > 0 ? directSize.h + SUB_GAP : 0)

    nodes.push({
      id:       vpc.id,
      type:     'vpc',
      position: { x: vpcX, y: 40 },
      style:    { width: vpcW, height: Math.max(160, vpcH) },
      data:     { label: vpc.label },
    })

    // Subnets in a single row inside the VPC
    let subX = VPC_PAD
    vpcSubnets.forEach((subnet, si) => {
      const { w: sw, h: sh } = subSizes[si]
      nodes.push({
        id:       subnet.id,
        type:     'subnet',
        parentId: vpc.id,
        extent:   'parent',
        position: { x: subX, y: VPC_LABEL },
        style:    { width: sw, height: sh },
        data:     { label: subnet.label, isPublic: subnet.metadata.mapPublicIp },
      })

      // Resources inside this subnet
      const rNodes = resourcesByParent.get(subnet.id) ?? []
      rNodes.forEach((r, ri) => {
        const col = ri % RES_COLS
        const row = Math.floor(ri / RES_COLS)
        nodes.push({
          id:       r.id,
          type:     'resource',
          parentId: subnet.id,
          extent:   'parent',
          position: {
            x: SUB_PAD_X + col * (RES_W + RES_GAP_X),
            y: SUB_PAD_Y + row * (RES_H + RES_GAP_Y),
          },
          data:     { label: r.label, nodeType: r.type, status: r.status },
          selected: r.id === selectedId,
        })
      })
      subX += sw + SUB_GAP
    })

    // Resources attached directly to the VPC (e.g. ALBs, SGs without a subnet)
    const subnetBottom = VPC_LABEL + VPC_PAD + maxSubH + SUB_GAP
    directRes.forEach((r, ri) => {
      const col = ri % RES_COLS
      const row = Math.floor(ri / RES_COLS)
      nodes.push({
        id:       r.id,
        type:     'resource',
        parentId: vpc.id,
        extent:   'parent',
        position: {
          x: VPC_PAD + col * (RES_W + RES_GAP_X),
          y: subnetBottom + row * (RES_H + RES_GAP_Y),
        },
        data:     { label: r.label, nodeType: r.type, status: r.status },
        selected: r.id === selectedId,
      })
    })

    vpcX += vpcW + VPC_GAP
  })

  // Resources with no parent (S3, Lambda, ALB if not VPC-attached, etc.)
  // rendered in a row below all VPCs
  const ROOT_COLS = 5
  rootResources.forEach((r, i) => {
    nodes.push({
      id:       r.id,
      type:     'resource',
      position: { x: 40 + (i % ROOT_COLS) * (RES_W + RES_GAP_X + 40), y: 520 + Math.floor(i / ROOT_COLS) * (RES_H + RES_GAP_Y + 20) },
      data:     { label: r.label, nodeType: r.type, status: r.status },
      selected: r.id === selectedId,
    })
  })

  return nodes
}

interface TopologyViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function TopologyView({ onNodeContextMenu }: TopologyViewProps){
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
