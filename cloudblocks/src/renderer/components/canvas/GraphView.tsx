import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { ReactFlow, Background, BackgroundVariant, MiniMap, useReactFlow, type Node, type Edge, type NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { NodeType, EdgeType, IntegrationEdgeData } from '../../types/cloud'
import { ResourceNode } from './nodes/ResourceNode'
import { AcmNode } from './nodes/AcmNode'
import { CloudFrontNode } from './nodes/CloudFrontNode'
import { ApigwNode } from './nodes/ApigwNode'
import { ApigwRouteNode } from './nodes/ApigwRouteNode'
import type { CloudNode } from '../../types/cloud'

const SNAP_GRID_SIZE = 20

const NODE_TYPES = {
  resource:      ResourceNode,
  acm:           AcmNode,
  cloudfront:    CloudFrontNode,
  apigw:         ApigwNode,
  'apigw-route': ApigwRouteNode,
}

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
  const edges: Edge[] = []

  // Parent → child edges (skip apigw-route — handled separately below)
  nodes
    .filter((n) => n.parentId && n.type !== 'apigw-route')
    .forEach((n) => {
      edges.push({
        id:     `${n.parentId}-${n.id}`,
        source: n.parentId!,
        target: n.id,
        type:   'step',
        style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
      })
    })

  // CloudFront → origin edges + CloudFront → ACM cert edges
  const s3Nodes     = nodes.filter((n) => n.type === 's3')
  const albNodes    = nodes.filter((n) => n.type === 'alb')
  const acmNodes    = nodes.filter((n) => n.type === 'acm')
  const cfNodes     = nodes.filter((n) => n.type === 'cloudfront')
  const lambdaNodes = nodes.filter((n) => n.type === 'lambda')

  cfNodes.forEach((cf) => {
    const origins = (cf.metadata.origins ?? []) as Array<{ id: string; domainName: string; type: string }>

    // Origin edges
    origins.forEach((origin) => {
      const s3Match = s3Nodes.find((s) => origin.domainName.startsWith(s.id + '.'))
      if (s3Match) {
        edges.push({
          id:     `cf-origin-${cf.id}-${s3Match.id}`,
          source: cf.id,
          target: s3Match.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
        })
        return
      }
      const albMatch = albNodes.find((a) => origin.domainName === (a.metadata.dnsName as string))
      if (albMatch) {
        edges.push({
          id:     `cf-origin-${cf.id}-${albMatch.id}`,
          source: cf.id,
          target: albMatch.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
        })
      }
    })

    // Cert edge (dotted)
    const certArn = cf.metadata.certArn as string | undefined
    if (certArn) {
      const certNode = acmNodes.find((a) => a.id === certArn)
      if (certNode) {
        edges.push({
          id:     `cf-cert-${cf.id}`,
          source: cf.id,
          target: certNode.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
          label:  'cert',
        })
      }
    }
  })

  // API Gateway route edges
  nodes.filter((n) => n.type === 'apigw-route').forEach((route) => {
    // route → parent apigw
    if (route.parentId) {
      edges.push({
        id:     `apigw-route-${route.id}`,
        source: route.parentId,
        target: route.id,
        type:   'step',
        style:  { stroke: 'var(--cb-border)', strokeWidth: 1 },
      })
    }

    // route → lambda integration (dotted)
    const lambdaArn = route.metadata.lambdaArn as string | undefined
    if (lambdaArn) {
      const lambdaNode = lambdaNodes.find((n) => n.id === lambdaArn || n.metadata.arn === lambdaArn)
      if (lambdaNode) {
        edges.push({
          id:     `route-lambda-${route.id}`,
          source: route.id,
          target: lambdaNode.id,
          type:   'step',
          label:  'integration',
          style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
        })
      }
    }
  })

  // Integration edges
  for (const node of nodes) {
    if (!node.integrations) continue
    for (const integration of node.integrations) {
      const targetExists = nodes.some(n => n.id === integration.targetId)
      if (!targetExists) continue
      const animated = integration.edgeType === 'trigger' && nodes.length < 50
      edges.push({
        id: `integration-${node.id}-${integration.targetId}`,
        source: node.id,
        target: integration.targetId,
        animated,
        style: integration.edgeType === 'trigger'
          ? { strokeDasharray: '5 5' }
          : integration.edgeType === 'subscription'
          ? { strokeDasharray: '2 4' }
          : undefined,
        data: { isIntegration: true as const, edgeType: integration.edgeType as EdgeType },
      })
    }
  }

  return edges
}

interface GraphViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function GraphView({ onNodeContextMenu }: GraphViewProps): React.JSX.Element {
  const cloudNodes         = useCloudStore((s) => s.nodes)
  const pendingNodes       = useCloudStore((s) => s.pendingNodes)
  const selectNode         = useUIStore((s) => s.selectNode)
  const selectedId         = useUIStore((s) => s.selectedNodeId)
  const setActiveCreate    = useUIStore((s) => s.setActiveCreate)
  const view               = useUIStore((s) => s.view)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const graphPositions  = useUIStore((s) => s.nodePositions.graph)
  const setNodePosition = useUIStore((s) => s.setNodePosition)

  // One-time fitView when nodes first appear (or re-appear after dropping to 0)
  const hasFitted = useRef(false)
  useEffect(() => {
    if (cloudNodes.length === 0) {
      hasFitted.current = false
      return
    }
    if (!hasFitted.current) {
      hasFitted.current = true
      fitView({ duration: 300 })
    }
  }, [cloudNodes.length, fitView])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/plain') as NodeType
    if (!type) return
    const dropPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setActiveCreate({ resource: type, view, dropPosition })
  }, [screenToFlowPosition, view, setActiveCreate])

  // Track drag positions in local state so controlled nodes follow the mouse,
  // and persist to the store only on drag-end.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const nextLive: Record<string, { x: number; y: number }> = {}
    const toClear: string[] = []

    for (const change of changes) {
      if (change.type !== 'position' || !change.position) continue
      if (change.dragging) {
        nextLive[change.id] = change.position
      } else {
        toClear.push(change.id)
        setNodePosition('graph', change.id, change.position)
      }
    }

    if (Object.keys(nextLive).length > 0 || toClear.length > 0) {
      setLivePositions((prev) => {
        const next = { ...prev, ...nextLive }
        toClear.forEach((id) => delete next[id])
        return next
      })
    }
  }, [setNodePosition])

  const allNodes = useMemo(() => [...cloudNodes, ...pendingNodes], [cloudNodes, pendingNodes])

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

  // Compute highlighted set for focus mode
  const highlightedIds = useMemo<Set<string> | null>(() => {
    if (!selectedId) return null
    const rawEdges = deriveEdges(allNodes)
    const neighbours = new Set<string>([selectedId])
    for (const e of rawEdges) {
      if (e.source === selectedId) neighbours.add(e.target)
      if (e.target === selectedId) neighbours.add(e.source)
    }
    return neighbours
  }, [selectedId, allNodes])

  // Track in-flight drag positions so controlled nodes follow the mouse.
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({})

  const flowNodes: Node[] = useMemo(
    () => allNodes.map((n, i) => {
      const vpc      = findVpcAncestor(n, byId)
      const vpcColor = vpc ? (vpcColorMap.get(vpc.id) ?? undefined) : undefined
      const vpcLabel = vpc ? vpc.label : undefined

      // Use dedicated node types for ACM, CloudFront, and API Gateway
      const rfType =
        n.type === 'acm'          ? 'acm' :
        n.type === 'cloudfront'   ? 'cloudfront' :
        n.type === 'apigw'        ? 'apigw' :
        n.type === 'apigw-route'  ? 'apigw-route' :
        'resource'

      return {
        id:       n.id,
        type:     rfType,
        position: livePositions[n.id] ?? graphPositions[n.id] ?? { x: (i % 5) * 175 + 40, y: Math.floor(i / 5) * 110 + 60 },
        data:     {
          label:     n.label,
          nodeType:  n.type,
          status:    n.status,
          vpcLabel:  n.type !== 'vpc' && n.type !== 'subnet' ? vpcLabel : undefined,
          vpcColor:  n.type !== 'vpc' && n.type !== 'subnet' ? vpcColor : undefined,
          // API Gateway route extra fields
          method:    n.type === 'apigw-route' ? n.metadata.method as string | undefined : undefined,
          path:      n.type === 'apigw-route' ? n.metadata.path   as string | undefined : undefined,
          hasLambda: n.type === 'apigw-route' ? !!(n.metadata.lambdaArn) : undefined,
          // API Gateway container extra fields
          endpoint:  n.type === 'apigw' ? n.metadata.endpoint as string | undefined : undefined,
          // Focus mode
          dimmed:    highlightedIds !== null && !highlightedIds.has(n.id),
        },
        selected: n.id === selectedId,
      }
    }),
    [allNodes, selectedId, byId, vpcColorMap, highlightedIds, graphPositions, livePositions],
  )

  const flowEdges: Edge[] = useMemo(() => {
    const raw = deriveEdges(allNodes)
    const filtered = showIntegrations
      ? raw
      : raw.filter((e) => !(e.data as IntegrationEdgeData | undefined)?.isIntegration)
    if (!selectedId) return filtered
    return filtered.map((e) => {
      const incident = e.source === selectedId || e.target === selectedId
      return incident ? e : { ...e, style: { ...(e.style ?? {}), opacity: 0.15 } }
    })
  }, [allNodes, selectedId, showIntegrations])

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
      onDragOver={onDragOver}
      onDrop={onDrop}
      onNodesChange={onNodesChange}
      panOnScroll
      snapToGrid={snapToGrid}
      snapGrid={[SNAP_GRID_SIZE, SNAP_GRID_SIZE]}
      minZoom={0.1}
      maxZoom={2}
      style={{ background: 'var(--cb-canvas-bg)' }}
    >
      <Background id="minor" variant={BackgroundVariant.Lines} gap={SNAP_GRID_SIZE} color="rgba(255,255,255,0.015)" />
      <Background id="major" variant={BackgroundVariant.Lines} gap={100} color="rgba(255,255,255,0.035)" />
      <MiniMap
        style={{ background: 'var(--cb-minimap-bg)', border: '1px solid var(--cb-minimap-border)' }}
        nodeColor="#FF9900"
      />
    </ReactFlow>
  )
}
