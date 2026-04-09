import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  type Edge,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { ResourceNode } from './nodes/ResourceNode'
import type { CloudNode } from '../../types/cloud'
import { resolveIntegrationTargetId } from '../../utils/resolveIntegrationTargetId'
import { buildCommandNodes } from '../../utils/commandLayout'

// ── Layout constants (local — only needed for TierLabelNode width) ────────────

const LANE_X = 200

// ── TierLabelNode ─────────────────────────────────────────────────────────────

function TierLabelNode({ data }: { data: Record<string, unknown> }): React.JSX.Element {
  const name = data.name as string
  return (
    <div
      style={{
        fontFamily:    'monospace',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color:         'var(--cb-text-muted)',
        padding:       '0 8px',
        width:         LANE_X - 8,
        textAlign:     'right',
        userSelect:    'none',
        pointerEvents: 'none',
      }}
    >
      {name}
    </div>
  )
}

const nodeTypes = {
  resource:     ResourceNode,
  'tier-label': TierLabelNode,
} as const

// ── Integration edges ─────────────────────────────────────────────────────────

function buildCommandEdges(cloudNodes: CloudNode[], showIntegrations: boolean): Edge[] {
  if (!showIntegrations) return []
  const edges: Edge[] = []
  for (const node of cloudNodes) {
    if (!node.integrations) continue
    for (const { targetId, edgeType } of node.integrations) {
      const resolvedTargetId = resolveIntegrationTargetId(cloudNodes, targetId)
      const targetExists = cloudNodes.some((n) => n.id === resolvedTargetId)
      if (!targetExists) continue
      edges.push({
        id:       `cmd-${node.id}-${resolvedTargetId}`,
        source:   node.id,
        target:   resolvedTargetId,
        type:     'default',
        animated: edgeType === 'trigger',
        style:    { stroke: edgeType === 'trigger' ? '#64b5f6' : '#555', strokeWidth: 1.2 },
      })
    }
  }
  return edges
}

// ── CommandView ───────────────────────────────────────────────────────────────

interface Props {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function CommandView({ onNodeContextMenu }: Props): React.JSX.Element {
  const nodes              = useCloudStore((s) => s.nodes)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const commandPositions   = useUIStore((s) => s.commandPositions)
  const setCommandPosition = useUIStore((s) => s.setCommandPosition)
  const selectedNodeId     = useUIStore((s) => s.selectedNodeId)
  const selectNode         = useUIStore((s) => s.selectNode)

  const [livePositions, setLivePositions] = useState<Record<string, XYPosition>>({})

  const baseNodes = useMemo(() => buildCommandNodes(nodes), [nodes])

  const flowNodes = useMemo(() => {
    return baseNodes.map((n) => {
      if (n.type === 'tier-label') return n
      const stored = commandPositions[n.id]
      const live   = livePositions[n.id]
      const pos    = live ?? stored ?? n.position
      return { ...n, position: pos, selected: n.id === selectedNodeId }
    })
  }, [baseNodes, commandPositions, livePositions, selectedNodeId])

  const flowEdges = useMemo(() => buildCommandEdges(nodes, showIntegrations), [nodes, showIntegrations])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type !== 'position') continue
      if (!c.position) continue
      if (c.dragging) {
        setLivePositions((prev) => ({ ...prev, [c.id]: c.position! }))
      } else {
        setCommandPosition(c.id, c.position!)
        setLivePositions((prev) => {
          const next = { ...prev }
          delete next[c.id]
          return next
        })
      }
    }
  }, [setCommandPosition])

  // Context strip counts
  const vpcCount    = nodes.filter((n) => n.type === 'vpc').length
  const subnetCount = nodes.filter((n) => n.type === 'subnet').length
  const sgCount     = nodes.filter((n) => n.type === 'security-group').length
  const region      = nodes[0]?.region ?? ''

  return (
    <div className="flex flex-col w-full h-full">
      {/* Context strip */}
      {(vpcCount > 0 || subnetCount > 0 || sgCount > 0) && (
        <div
          style={{
            padding:      '2px 12px',
            fontFamily:   'monospace',
            fontSize:     9,
            color:        'var(--cb-text-muted)',
            background:   'var(--cb-bg-panel)',
            borderBottom: '1px solid var(--cb-border)',
            flexShrink:   0,
          }}
        >
          {vpcCount > 0 && <span>{vpcCount} VPC{vpcCount !== 1 ? 's' : ''} · </span>}
          {subnetCount > 0 && <span>{subnetCount} subnet{subnetCount !== 1 ? 's' : ''} · </span>}
          {sgCount > 0 && <span>{sgCount} security group{sgCount !== 1 ? 's' : ''}</span>}
          {region && <span style={{ marginLeft: 12 }}>{region}</span>}
        </div>
      )}

      <div className="flex-1">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_e, node) => selectNode(node.id)}
          onPaneClick={() => selectNode(null)}
          onNodeContextMenu={(e, node) => {
            const cloudNode = nodes.find((n) => n.id === node.id)
            if (cloudNode) onNodeContextMenu(cloudNode, e.clientX, e.clientY)
          }}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Background gap={20} color="var(--cb-border)" />
          <MiniMap
            style={{ background: 'var(--cb-minimap-bg)' }}
            nodeColor="var(--cb-border-strong)"
          />
        </ReactFlow>
      </div>
    </div>
  )
}
