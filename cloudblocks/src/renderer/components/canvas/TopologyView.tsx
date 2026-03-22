import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { ReactFlow, Background, BackgroundVariant, MiniMap, useReactFlow, type Node, type Edge, type NodeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { NodeType } from '../../types/cloud'
import { ResourceNode } from './nodes/ResourceNode'
import { VpcNode } from './nodes/VpcNode'
import { SubnetNode } from './nodes/SubnetNode'
import { GlobalZoneNode } from './nodes/GlobalZoneNode'
import { AcmNode } from './nodes/AcmNode'
import { CloudFrontNode } from './nodes/CloudFrontNode'
import { ApigwNode } from './nodes/ApigwNode'
import { ApigwRouteNode } from './nodes/ApigwRouteNode'
import type { CloudNode, EdgeType, IntegrationEdgeData } from '../../types/cloud'

const SNAP_GRID_SIZE = 20

const NODE_TYPES = {
  resource:    ResourceNode,
  vpc:         VpcNode,
  subnet:      SubnetNode,
  globalZone:  GlobalZoneNode,
  acm:         AcmNode,
  cloudfront:  CloudFrontNode,
  apigw:       ApigwNode,
  'apigw-route': ApigwRouteNode,
}

const CONTAINER_TYPES = new Set(['vpc', 'subnet', 'apigw'])

const RES_W     = 150
const RES_H     = 66
const RES_COLS  = 2
const RES_GAP_X = 12
const RES_GAP_Y = 12
const SUB_PAD_X = 12
const SUB_PAD_Y = 38
const SUB_GAP   = 16
const VPC_PAD   = 16
const VPC_GAP   = 48
const VPC_LABEL = 32

// Global zone constants
const GLOBAL_PAD   = 16
const GLOBAL_LABEL = 32

// API Gateway container constants
const APIGW_PAD       = 16
const APIGW_HEADER    = 32
const APIGW_ROUTE_H   = 36
const APIGW_ROUTE_GAP = 8
const APIGW_MIN_W     = 240

function subnetSize(resourceCount: number): { w: number; h: number } {
  const cols = Math.min(resourceCount || 1, RES_COLS)
  const rows = Math.max(1, Math.ceil(resourceCount / RES_COLS))
  return {
    w: Math.max(200, SUB_PAD_X * 2 + cols * RES_W + (cols - 1) * RES_GAP_X),
    h: Math.max(120, SUB_PAD_Y + rows * (RES_H + RES_GAP_Y) + RES_GAP_Y),
  }
}

const SUBNET_COLLAPSED_H = 32

function buildFlowNodes(cloudNodes: CloudNode[], selectedId: string | null, highlightedIds: Set<string> | null, collapsedSubnets: Set<string>): Node[] {
  const nodes: Node[] = []

  // Separate global nodes from regional nodes
  const globalNodes = cloudNodes.filter((n) => n.region === 'global')
  const regionalNodes = cloudNodes.filter((n) => n.region !== 'global')

  // Layout global zone
  let globalZoneHeight = 0
  let vpcY = 40

  if (globalNodes.length > 0) {
    const GLOBAL_COLS = 5
    const globalRows  = Math.ceil(globalNodes.length / GLOBAL_COLS)
    const globalW     = GLOBAL_PAD * 2 + Math.min(globalNodes.length, GLOBAL_COLS) * (RES_W + RES_GAP_X) - RES_GAP_X
    globalZoneHeight  = GLOBAL_LABEL + GLOBAL_PAD + globalRows * (RES_H + RES_GAP_Y)

    const GLOBAL_ZONE_ID = '__global_zone__'
    nodes.push({
      id:       GLOBAL_ZONE_ID,
      type:     'globalZone',
      position: { x: 40, y: 40 },
      style:    { width: Math.max(400, globalW), height: globalZoneHeight },
      data:     {},
      selectable: false,
      draggable:  false,
      zIndex:   0,
    })

    // Place global resource nodes inside the zone
    globalNodes.forEach((n, i) => {
      const col = i % GLOBAL_COLS
      const row = Math.floor(i / GLOBAL_COLS)
      const nodeType = n.type === 'acm' ? 'acm' : n.type === 'cloudfront' ? 'cloudfront' : 'resource'
      nodes.push({
        id:       n.id,
        type:     nodeType,
        parentId: GLOBAL_ZONE_ID,
        extent:   'parent',
        position: {
          x: GLOBAL_PAD + col * (RES_W + RES_GAP_X),
          y: GLOBAL_LABEL + row * (RES_H + RES_GAP_Y),
        },
        data:     { label: n.label, nodeType: n.type, status: n.status, driftStatus: n.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(n.id) },
        selected: n.id === selectedId,
        zIndex:   1,
      })
    })

    vpcY = 40 + globalZoneHeight + 60
  }

  // Bucket regional nodes by role
  const vpcs      = regionalNodes.filter((n) => n.type === 'vpc')
  const subnets   = regionalNodes.filter((n) => n.type === 'subnet')
  const apigws    = regionalNodes.filter((n) => n.type === 'apigw')
  const apigwRoutes = regionalNodes.filter((n) => n.type === 'apigw-route')
  const resources = regionalNodes.filter((n) => !CONTAINER_TYPES.has(n.type) && n.type !== 'apigw-route')

  const subnetsByVpc      = new Map<string, CloudNode[]>()
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

  // Place VPCs
  let vpcX = 40
  let maxVpcHeight = 0
  vpcs.forEach((vpc) => {
    const vpcSubnets = subnetsByVpc.get(vpc.id) ?? []
    const subSizes   = vpcSubnets.map((s) => {
      if (collapsedSubnets.has(s.id)) return { w: subnetSize((resourcesByParent.get(s.id) ?? []).length).w, h: SUBNET_COLLAPSED_H }
      return subnetSize((resourcesByParent.get(s.id) ?? []).length)
    })
    const totalSubW  = subSizes.reduce((sum, s) => sum + s.w, 0) + Math.max(0, vpcSubnets.length - 1) * SUB_GAP
    const maxSubH    = subSizes.length > 0 ? Math.max(...subSizes.map((s) => s.h)) : 120
    const directRes  = resourcesByParent.get(vpc.id) ?? []
    const directSize = subnetSize(directRes.length)
    const vpcW = Math.max(260, VPC_PAD * 2 + Math.max(totalSubW, directRes.length > 0 ? directSize.w : 0))
    const vpcH = VPC_LABEL + VPC_PAD + maxSubH + VPC_PAD + (directRes.length > 0 ? directSize.h + SUB_GAP : 0)
    const vpcHFinal = Math.max(160, vpcH)
    maxVpcHeight = Math.max(maxVpcHeight, vpcHFinal)

    nodes.push({
      id:       vpc.id,
      type:     'vpc',
      position: { x: vpcX, y: vpcY },
      style:    { width: vpcW, height: vpcHFinal },
      data:     { label: vpc.label, cidr: vpc.metadata.cidr as string | undefined },
    })

    let subX = VPC_PAD
    vpcSubnets.forEach((subnet, si) => {
      const { w: sw, h: sh } = subSizes[si]
      const isCollapsed = collapsedSubnets.has(subnet.id)
      nodes.push({
        id:       subnet.id,
        type:     'subnet',
        parentId: vpc.id,
        extent:   'parent',
        position: { x: subX, y: VPC_LABEL + VPC_PAD },
        style:    { width: sw, height: sh },
        data:     { label: subnet.label, isPublic: subnet.metadata.mapPublicIp, az: subnet.metadata.availabilityZone as string | undefined, collapsed: isCollapsed },
      })

      if (!isCollapsed) {
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
            data:     { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
            selected: r.id === selectedId,
          })
        })
      }
      subX += sw + SUB_GAP
    })

    const subnetBottom = VPC_LABEL + VPC_PAD + maxSubH + VPC_PAD + SUB_GAP
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
        data:     { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
        selected: r.id === selectedId,
      })
    })

    vpcX += vpcW + VPC_GAP
  })

  // Place API Gateway containers — same row as VPCs, appended to the right
  const routesByApi = new Map<string, CloudNode[]>()
  apigwRoutes.forEach((r) => {
    if (!r.parentId) return
    if (!routesByApi.has(r.parentId)) routesByApi.set(r.parentId, [])
    routesByApi.get(r.parentId)!.push(r)
  })

  apigws.forEach((api) => {
    const routes = routesByApi.get(api.id) ?? []
    const longestLabel = routes.reduce((max, r) => Math.max(max, r.label.length), 0)
    const apigwW = Math.max(APIGW_MIN_W, longestLabel * 7 + APIGW_PAD * 2)
    const apigwH = APIGW_HEADER + APIGW_PAD + routes.length * (APIGW_ROUTE_H + APIGW_ROUTE_GAP) + APIGW_PAD
    const apigwHFinal = Math.max(80, apigwH)
    maxVpcHeight = Math.max(maxVpcHeight, apigwHFinal)

    nodes.push({
      id:       api.id,
      type:     'apigw',
      position: { x: vpcX, y: vpcY },
      style:    { width: apigwW, height: apigwHFinal },
      data:     { label: api.label, endpoint: api.metadata.endpoint as string | undefined, dimmed: highlightedIds !== null && !highlightedIds.has(api.id) },
      selected: api.id === selectedId,
    })

    routes.forEach((route, ri) => {
      nodes.push({
        id:       route.id,
        type:     'apigw-route',
        parentId: api.id,
        extent:   'parent',
        position: {
          x: APIGW_PAD,
          y: APIGW_HEADER + APIGW_PAD + ri * (APIGW_ROUTE_H + APIGW_ROUTE_GAP),
        },
        style:    { width: apigwW - APIGW_PAD * 2 },
        data: {
          label:     route.label,
          method:    route.metadata.method as string | undefined,
          path:      route.metadata.path as string | undefined,
          hasLambda: !!(route.metadata.lambdaArn),
          dimmed:    highlightedIds !== null && !highlightedIds.has(route.id),
        },
        selected: route.id === selectedId,
      })
    })

    vpcX += apigwW + VPC_GAP
  })

  // Root resources (no parent) — row below all VPCs
  const ROOT_COLS  = 5
  const rootY      = vpcY + maxVpcHeight + 60
  rootResources.forEach((r, i) => {
    nodes.push({
      id:       r.id,
      type:     'resource',
      position: { x: 40 + (i % ROOT_COLS) * (RES_W + RES_GAP_X + 40), y: rootY + Math.floor(i / ROOT_COLS) * (RES_H + RES_GAP_Y + 20) },
      data:     { label: r.label, nodeType: r.type, status: r.status, driftStatus: r.driftStatus, region: r.region, dimmed: highlightedIds !== null && !highlightedIds.has(r.id) },
      selected: r.id === selectedId,
    })
  })

  return nodes
}

// Build topology edges: CloudFront → origin, route → lambda
function buildTopologyEdges(cloudNodes: CloudNode[]): Edge[] {
  const edges: Edge[] = []
  const s3Nodes     = cloudNodes.filter((n) => n.type === 's3')
  const albNodes    = cloudNodes.filter((n) => n.type === 'alb')
  const apigwNodes  = cloudNodes.filter((n) => n.type === 'apigw')
  const cfNodes     = cloudNodes.filter((n) => n.type === 'cloudfront')
  const lambdaNodes = cloudNodes.filter((n) => n.type === 'lambda')
  const routeNodes  = cloudNodes.filter((n) => n.type === 'apigw-route')

  cfNodes.forEach((cf) => {
    const origins = (cf.metadata.origins ?? []) as Array<{ id: string; domainName: string; type: string }>
    origins.forEach((origin) => {
      // S3 match: origin domainName starts with <bucketName>.
      const s3Match = s3Nodes.find((s) => origin.domainName.startsWith(s.id + '.'))
      if (s3Match) {
        edges.push({
          id:     `cf-origin-${cf.id}-${s3Match.id}`,
          source: cf.id,
          target: s3Match.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
          zIndex: 10,
        })
        return
      }
      // ALB match: origin domainName === alb dnsName
      const albMatch = albNodes.find((a) => origin.domainName === (a.metadata.dnsName as string))
      if (albMatch) {
        edges.push({
          id:     `cf-origin-${cf.id}-${albMatch.id}`,
          source: cf.id,
          target: albMatch.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
          zIndex: 10,
        })
        return
      }
      // APIGW match: strip protocol from metadata.endpoint and compare to origin domainName
      const apigwMatch = apigwNodes.find((a) => {
        const endpoint = (a.metadata.endpoint as string | undefined) ?? ''
        return endpoint.replace(/^https?:\/\//, '') === origin.domainName
      })
      if (apigwMatch) {
        edges.push({
          id:     `cf-origin-${cf.id}-${apigwMatch.id}`,
          source: cf.id,
          target: apigwMatch.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
          zIndex: 10,
        })
      }
    })
  })

  // Route → Lambda integration edges (dotted)
  routeNodes.forEach((route) => {
    const lambdaArn = route.metadata.lambdaArn as string | undefined
    if (!lambdaArn) return
    const lambdaNode = lambdaNodes.find((n) => n.id === lambdaArn || n.metadata.arn === lambdaArn)
    if (!lambdaNode) return
    edges.push({
      id:     `route-lambda-${route.id}`,
      source: route.id,
      target: lambdaNode.id,
      type:   'step',
      label:  'integration',
      style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
    })
  })

  // Integration edges from node.integrations[]
  for (const node of cloudNodes) {
    if (!node.integrations) continue
    for (const integration of node.integrations) {
      const targetExists = cloudNodes.some((n) => n.id === integration.targetId)
      if (!targetExists) continue
      const edgeType: EdgeType = integration.edgeType
      const animated = edgeType === 'trigger' && cloudNodes.length < 50
      edges.push({
        id:       `integration-${node.id}-${integration.targetId}`,
        source:   node.id,
        target:   integration.targetId,
        animated,
        style:    edgeType === 'trigger'
          ? { strokeDasharray: '5 5' }
          : edgeType === 'subscription'
          ? { strokeDasharray: '2 4' }
          : undefined, // solid for 'origin'
        data:     { isIntegration: true as const, edgeType },
      })
    }
  }

  return edges
}

interface TopologyViewProps {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function TopologyView({ onNodeContextMenu }: TopologyViewProps): React.JSX.Element {
  const cloudNodes         = useCloudStore((s) => s.nodes)
  const pendingNodes       = useCloudStore((s) => s.pendingNodes)
  const importedNodes      = useCloudStore((s) => s.importedNodes)
  const selectNode         = useUIStore((s) => s.selectNode)
  const selectEdge         = useUIStore((s) => s.selectEdge)
  const selectedId         = useUIStore((s) => s.selectedNodeId)
  const setActiveCreate    = useUIStore((s) => s.setActiveCreate)
  const view               = useUIStore((s) => s.view)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const lockedNodes        = useUIStore((s) => s.lockedNodes)
  const collapsedSubnets   = useUIStore((s) => s.collapsedSubnets)
  const toggleSubnet       = useUIStore((s) => s.toggleSubnet)
  const annotations        = useUIStore((s) => s.annotations)
  const driftFilterActive  = useUIStore((s) => s.driftFilterActive)
  const sidebarFilter      = useUIStore((s) => s.sidebarFilter)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const topologyPositions = useUIStore((s) => s.nodePositions.topology)
  const setNodePosition   = useUIStore((s) => s.setNodePosition)

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

  const allNodes = useMemo(() => [...cloudNodes, ...pendingNodes], [cloudNodes, pendingNodes])

  // Compute highlighted set for focus mode
  const highlightedIds = useMemo<Set<string> | null>(() => {
    if (sidebarFilter) {
      return new Set(allNodes.filter((n) => n.type === sidebarFilter).map((n) => n.id))
    }
    if (!selectedId) return null
    const rawEdges = buildTopologyEdges(allNodes)
    const neighbours = new Set<string>([selectedId])
    for (const e of rawEdges) {
      if (e.source === selectedId) neighbours.add(e.target)
      if (e.target === selectedId) neighbours.add(e.source)
    }
    return neighbours
  }, [selectedId, allNodes, sidebarFilter])

  // Track in-flight drag positions so controlled nodes follow the mouse.
  // Only persisted to the store on drag-end; cleared on drop.
  const [livePositions, setLivePositions] = useState<Record<string, { x: number; y: number }>>({})

  // Only top-level nodes (no parentId, not in global zone) have draggable positions
  // we want to persist. Everything else (child nodes, phantom IDs) is ignored.
  const topLevelNodeIds = useMemo(() => {
    const set = new Set<string>()
    allNodes.forEach((n) => {
      if (!n.parentId && n.region !== 'global') set.add(n.id)
    })
    // Also include imported nodes that render at the top level (no parentId)
    importedNodes.forEach((n) => { if (!n.parentId) set.add(n.id) })
    return set
  }, [allNodes, importedNodes])

  const flowNodes: Node[] = useMemo(() => {
    const raw = buildFlowNodes(allNodes, selectedId, highlightedIds, collapsedSubnets)
    const mapped = raw.map((n) => {
      const isLocked = lockedNodes.has(n.id)
      // Apply lock properties to all nodes (container nodes never get locked draggable/selectable
      // overrides since they already have those set to false in buildFlowNodes)
      const lockProps = isLocked
        ? { draggable: false, selectable: false, zIndex: -1 }
        : {}

      if (n.extent === 'parent') {
        // Child nodes: only patch data for lock indicator, no position override
        // For subnet nodes, inject the toggleSubnet callback
        if (n.type === 'subnet') {
          return { ...n, data: { ...n.data, onToggleCollapse: () => toggleSubnet(n.id), ...(isLocked ? { locked: true } : {}) }, ...(isLocked ? lockProps : {}) }
        }
        return isLocked
          ? { ...n, ...lockProps, data: { ...n.data, locked: true } }
          : n
      }

      const live  = livePositions[n.id]
      const saved = topologyPositions[n.id]
      const position = live ?? saved ?? n.position

      // For top-level subnet nodes (no parentId), also inject toggleSubnet
      if (n.type === 'subnet') {
        return {
          ...n,
          position,
          ...lockProps,
          data: { ...n.data, onToggleCollapse: () => toggleSubnet(n.id), ...(isLocked ? { locked: true } : {}), annotation: annotations[n.id] },
        }
      }

      return {
        ...n,
        position,
        ...lockProps,
        data: { ...n.data, ...(isLocked ? { locked: true } : {}), annotation: annotations[n.id] },
      }
    })

    // Append imported nodes (from Terraform state import) as resource nodes
    const existingIds = new Set(mapped.map((n) => n.id))
    const importedFlowNodes: Node[] = importedNodes
      .filter((n) => !existingIds.has(n.id))
      .map((n) => {
        // Only keep parentId if the parent already exists in the flow nodes
        const parentExists = n.parentId != null && mapped.some((fn) => fn.id === n.parentId)
        const base: Node = {
          id:       n.id,
          type:     'resource',
          position: topologyPositions[n.id] ?? { x: 50, y: 50 },
          data:     { label: n.label, nodeType: n.type, status: n.status, driftStatus: n.driftStatus },
          selected: n.id === selectedId,
        }
        if (parentExists) {
          return { ...base, parentId: n.parentId as string }
        }
        return base
      })

    const all = [...mapped, ...importedFlowNodes]
    if (!driftFilterActive) return all
    const DRIFT_CONTAINER_TYPES = new Set(['vpc', 'subnet', 'apigw', 'globalZone', 'apigw-route'])
    return all.filter((fn) => {
      if (DRIFT_CONTAINER_TYPES.has(fn.type ?? '')) return true
      const d = fn.data as { driftStatus?: string }
      return d.driftStatus === 'unmanaged' || d.driftStatus === 'missing'
    })
  }, [allNodes, selectedId, highlightedIds, topologyPositions, livePositions, lockedNodes, collapsedSubnets, toggleSubnet, annotations, importedNodes, driftFilterActive, sidebarFilter])

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

  // Track drag positions in local state (so controlled nodes follow the mouse),
  // and persist to the store only on drag-end.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const nextLive: Record<string, { x: number; y: number }> = {}
    const toClear: string[] = []

    for (const change of changes) {
      if (change.type !== 'position' || !change.position) continue
      if (!topLevelNodeIds.has(change.id)) continue  // ignore child/phantom nodes

      if (change.dragging) {
        nextLive[change.id] = change.position
      } else {
        toClear.push(change.id)
        setNodePosition('topology', change.id, change.position)
      }
    }

    if (Object.keys(nextLive).length > 0 || toClear.length > 0) {
      setLivePositions((prev) => {
        const next = { ...prev, ...nextLive }
        toClear.forEach((id) => delete next[id])
        return next
      })
    }
  }, [topLevelNodeIds, setNodePosition])

  const flowEdges: Edge[] = useMemo(() => {
    const raw = buildTopologyEdges(allNodes)
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
      onNodeClick={(_e, node) => { if (!lockedNodes.has(node.id)) selectNode(node.id) }}
      onNodeDoubleClick={(_e, node) => selectNode(node.id)}
      onEdgeClick={(_e, edge) => selectEdge({ id: edge.id, source: edge.source, target: edge.target, label: typeof edge.label === 'string' ? edge.label : undefined, data: edge.data as Record<string, unknown> | undefined })}
      onPaneClick={() => { selectNode(null); selectEdge(null) }}
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
