import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  type MouseEvent as ReactMouseEvent
} from 'react'
import {
  ReactFlow,
  Background,
  MiniMap,
  useReactFlow,
  type Edge,
  type NodeChange,
  type XYPosition
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { ResourceNode } from './nodes/ResourceNode'
import type { CloudNode, NodeType } from '../../types/cloud'
import { resolveIntegrationTargetId } from '../../utils/resolveIntegrationTargetId'
import { buildCommandNodes, getTierForNode } from '../../utils/commandLayout'
import {
  buildBlastRadius,
  hopRingStyle,
  directionSymbol,
  applyBlastRadiusToEdges
} from '../../utils/blastRadius'

// ── Layout constants (local — only needed for TierLabelNode width) ────────────

const LANE_X = 200

// Container-type nodes that stay visible (full opacity) during blast radius
const BLAST_CONTAINER_TYPES = new Set([
  'vpc',
  'subnet',
  'security-group',
  'nat-gateway',
  'globalZone',
  'regionZone'
])

// ── TierLabelNode ─────────────────────────────────────────────────────────────

function TierLabelNode({ data }: { data: Record<string, unknown> }): React.JSX.Element {
  const name = data.name as string
  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: '#cbd5e1',
        padding: '0 8px',
        width: LANE_X - 8,
        textAlign: 'right',
        userSelect: 'none',
        pointerEvents: 'none',
        borderRight: '1px solid rgba(203,213,225,0.25)'
      }}
    >
      {name}
    </div>
  )
}

const nodeTypes = {
  resource: ResourceNode,
  'tier-label': TierLabelNode
} as const

// ── Integration edges ─────────────────────────────────────────────────────────

// Pick the source/target handle sides based on relative tier positions so edges
// route cleanly between swim lanes without cutting through unrelated nodes.
function edgeHandles(
  sourceTier: number,
  targetTier: number
): { sourceHandle: string; targetHandle: string } {
  if (sourceTier < targetTier) return { sourceHandle: 'bottom', targetHandle: 'top' }
  if (sourceTier > targetTier) return { sourceHandle: 'top', targetHandle: 'bottom' }
  // Same tier — route horizontally
  return { sourceHandle: 'right', targetHandle: 'left' }
}

function buildCommandEdges(cloudNodes: CloudNode[], showIntegrations: boolean): Edge[] {
  if (!showIntegrations) return []
  const nodeMap = new Map(cloudNodes.map((n) => [n.id, n]))
  const edges: Edge[] = []
  for (const node of cloudNodes) {
    if (!node.integrations) continue
    for (const { targetId, edgeType } of node.integrations) {
      const resolvedTargetId = resolveIntegrationTargetId(cloudNodes, targetId)
      const target = nodeMap.get(resolvedTargetId)
      if (!target) continue

      const srcTier = getTierForNode(node.type as NodeType)
      const tgtTier = getTierForNode(target.type as NodeType)
      const { sourceHandle, targetHandle } = edgeHandles(srcTier, tgtTier)

      const isTrigger = edgeType === 'trigger'
      edges.push({
        id: `cmd-${node.id}-${resolvedTargetId}`,
        source: node.id,
        target: resolvedTargetId,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: isTrigger,
        style: {
          stroke: isTrigger ? '#64b5f6' : '#4a5568',
          strokeWidth: 1.5,
          opacity: 0.75
        }
      })
    }
  }
  return edges
}

// Internet-facing source node types for path trace
const INTERNET_SOURCE_TYPES = new Set(['igw', 'cloudfront', 'apigw'])

// ── CommandView ───────────────────────────────────────────────────────────────

interface Props {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

export function CommandView({ onNodeContextMenu }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const showIntegrations = useUIStore((s) => s.showIntegrations)
  const commandPositions = useUIStore((s) => s.commandPositions)
  const setCommandPosition = useUIStore((s) => s.setCommandPosition)
  const selectedNodeId = useUIStore((s) => s.selectedNodeId)
  const selectNode = useUIStore((s) => s.selectNode)
  const commandFocusId = useUIStore((s) => s.commandFocusId)
  const setCommandFocusId = useUIStore((s) => s.setCommandFocusId)
  const blastRadiusId = useUIStore((s) => s.blastRadiusId)
  const setBlastRadiusId = useUIStore((s) => s.setBlastRadiusId)
  const pathTraceId = useUIStore((s) => s.pathTraceId)
  const setPathTraceId = useUIStore((s) => s.setPathTraceId)
  const savedViewport = useUIStore((s) => s.savedViewport)
  const setSavedViewport = useUIStore((s) => s.setSavedViewport)

  const { fitView, getViewport, setViewport } = useReactFlow()

  const [livePositions, setLivePositions] = useState<Record<string, XYPosition>>({})

  // Path trace animation state (local, transient)
  const [pathTraceNodes, setPathTraceNodes] = useState<string[]>([])
  const [pathTraceRevealedCount, setPathTraceRevealedCount] = useState(0)

  const baseNodes = useMemo(() => buildCommandNodes(nodes), [nodes])

  // When focus mode is active, show only the focused node plus its direct neighbours
  const focusedNodeIds = useMemo((): Set<string> | null => {
    if (!commandFocusId) return null
    const focusCloud = nodes.find((n) => n.id === commandFocusId)
    if (!focusCloud) return null
    const ids = new Set([commandFocusId])
    for (const n of nodes) {
      for (const { targetId } of n.integrations ?? []) {
        if (targetId === commandFocusId || n.id === commandFocusId) {
          ids.add(n.id)
          ids.add(targetId)
        }
      }
    }
    return ids
  }, [commandFocusId, nodes])

  // Blast radius: bidirectional BFS with hop distance + direction
  const blastRadius = useMemo(
    () => (blastRadiusId ? buildBlastRadius(nodes, blastRadiusId) : null),
    [blastRadiusId, nodes]
  )

  // ── Path trace ────────────────────────────────────────────────────────────────
  const inboundMap = useMemo((): Map<string, string[]> => {
    const map = new Map<string, string[]>()
    for (const n of nodes) {
      for (const { targetId } of n.integrations ?? []) {
        const arr = map.get(targetId) ?? []
        arr.push(n.id)
        map.set(targetId, arr)
      }
    }
    return map
  }, [nodes])

  const runPathTrace = useCallback(
    (nodeId: string) => {
      const visited = new Set<string>()
      const queue: string[] = [nodeId]
      while (queue.length > 0) {
        const curr = queue.shift()!
        if (visited.has(curr)) continue
        visited.add(curr)
        const inbounds = inboundMap.get(curr) ?? []
        for (const src of inbounds) {
          if (!visited.has(src)) queue.push(src)
        }
      }
      const sources = [...visited].filter((id) => {
        const n = nodes.find((x) => x.id === id)
        return n && INTERNET_SOURCE_TYPES.has(n.type)
      })
      const ordered = [...visited].filter((id) => id !== nodeId)
      ordered.sort((a) => (sources.includes(a) ? -1 : 1))
      ordered.push(nodeId)
      setPathTraceNodes(ordered)
      setPathTraceRevealedCount(0)
    },
    [nodes, inboundMap]
  )

  useEffect(() => {
    if (pathTraceNodes.length === 0 || !pathTraceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPathTraceRevealedCount(0)
      return
    }
    if (pathTraceRevealedCount >= pathTraceNodes.length) return
    const timer = setInterval(() => {
      setPathTraceRevealedCount((c) => {
        if (c >= pathTraceNodes.length) {
          clearInterval(timer)
          return c
        }
        return c + 1
      })
    }, 150)
    return () => clearInterval(timer)
  }, [pathTraceNodes, pathTraceId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pathTraceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPathTraceNodes([])

      setPathTraceRevealedCount(0)
      return
    }
    runPathTrace(pathTraceId)
  }, [pathTraceId, runPathTrace])

  const pathTraceRevealedSet = useMemo((): Set<string> => {
    return new Set(pathTraceNodes.slice(0, pathTraceRevealedCount))
  }, [pathTraceNodes, pathTraceRevealedCount])

  // ── Blast radius fit-view on activation / restore on deactivation ─────────────
  useEffect(() => {
    if (blastRadiusId && blastRadius) {
      // Save current viewport before fitting
      setSavedViewport(getViewport())
      const memberIds = [...blastRadius.members.keys()]
      fitView({ nodes: memberIds.map((id) => ({ id })), duration: 300, padding: 0.3 })
    } else if (!blastRadiusId && savedViewport) {
      setViewport(savedViewport, { duration: 300 })
      setSavedViewport(null)
    }
  }, [blastRadiusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const flowNodes = useMemo(() => {
    return baseNodes
      .filter((n) => {
        if (!focusedNodeIds) return true
        if (n.type === 'tier-label') return true // always show tier labels
        return focusedNodeIds.has(n.id)
      })
      .map((n) => {
        if (n.type === 'tier-label') return n
        const stored = commandPositions[n.id]
        const live = livePositions[n.id]
        const pos = live ?? stored ?? n.position

        let opacity = 1
        let boxShadow: string | undefined
        let blastInfo: { hop: number; direction: string; edgeTypes: string[] } | undefined

        const isContainer = BLAST_CONTAINER_TYPES.has(n.type ?? '')

        if (blastRadius) {
          const member = blastRadius.members.get(n.id)
          if (isContainer) {
            opacity = 1
          } else if (member) {
            opacity = 1
            boxShadow = hopRingStyle(member.hopDistance)
            blastInfo = {
              hop: member.hopDistance,
              direction: member.direction,
              edgeTypes: member.edgeTypes
            }
          } else {
            opacity = 0
            // pointerEvents handled via style below
          }
        } else if (pathTraceId) {
          if (pathTraceRevealedSet.has(n.id)) {
            opacity = 1
            boxShadow = '0 0 8px #60a5fa'
          } else {
            opacity = 0.15
          }
        }

        const pointerEvents =
          blastRadius && !isContainer && !blastRadius.members.has(n.id) ? 'none' : undefined

        return {
          ...n,
          position: pos,
          selected: n.id === selectedNodeId,
          style: {
            ...(n.style ?? {}),
            opacity,
            transition: 'opacity 0.15s ease',
            ...(boxShadow ? { boxShadow } : {}),
            ...(pointerEvents ? { pointerEvents } : {})
          },
          data: blastInfo ? { ...(n.data ?? {}), blastInfo } : n.data
        }
      })
  }, [
    baseNodes,
    commandPositions,
    livePositions,
    selectedNodeId,
    focusedNodeIds,
    blastRadius,
    pathTraceId,
    pathTraceRevealedSet
  ])

  const flowEdges = useMemo(
    () => applyBlastRadiusToEdges(buildCommandEdges(nodes, showIntegrations), blastRadius),
    [nodes, showIntegrations, blastRadius]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
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
    },
    [setCommandPosition]
  )

  // Context strip counts
  const vpcCount = nodes.filter((n) => n.type === 'vpc').length
  const subnetCount = nodes.filter((n) => n.type === 'subnet').length
  const sgCount = nodes.filter((n) => n.type === 'security-group').length
  const region = nodes[0]?.region ?? ''

  const blastNode = blastRadiusId ? nodes.find((n) => n.id === blastRadiusId) : null

  return (
    <div className="relative w-full h-full">
      {/* Context strip — absolutely positioned, consistent with topology/graph views */}
      {(vpcCount > 0 ||
        subnetCount > 0 ||
        sgCount > 0 ||
        !!commandFocusId ||
        !!blastRadiusId ||
        !!pathTraceId) && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 10,
            padding: '2px 10px',
            fontFamily: 'monospace',
            fontSize: 9,
            color: 'var(--cb-text-muted)',
            background: 'var(--cb-bg-panel)',
            border: '1px solid var(--cb-border)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <span>
            {vpcCount > 0 && (
              <span>
                {vpcCount} VPC{vpcCount !== 1 ? 's' : ''} ·{' '}
              </span>
            )}
            {subnetCount > 0 && (
              <span>
                {subnetCount} subnet{subnetCount !== 1 ? 's' : ''} ·{' '}
              </span>
            )}
            {sgCount > 0 && (
              <span>
                {sgCount} security group{sgCount !== 1 ? 's' : ''}
              </span>
            )}
            {region && <span style={{ marginLeft: 12 }}>{region}</span>}
          </span>

          {commandFocusId && (
            <span
              style={{ color: 'var(--cb-accent)', cursor: 'pointer' }}
              onClick={() => setCommandFocusId(null)}
              title="Exit focus mode"
            >
              FOCUS · {nodes.find((n) => n.id === commandFocusId)?.label ?? commandFocusId} ✕
            </span>
          )}

          {blastRadiusId && blastRadius && (
            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ cursor: 'pointer' }}
                onClick={() => setBlastRadiusId(null)}
                title="Clear blast radius"
              >
                BLAST RADIUS
                {' · '}
                {blastNode?.label ?? blastRadiusId}
                {' · '}
                {blastRadius.members.size} node{blastRadius.members.size !== 1 ? 's' : ''}
                {' · '}
                {blastRadius.upstreamCount > 0 && <span>↑{blastRadius.upstreamCount} </span>}
                {blastRadius.downstreamCount > 0 && <span>↓{blastRadius.downstreamCount} </span>}
                {' ✕'}
              </span>
              <span
                style={{ cursor: 'pointer', opacity: 0.8 }}
                title="Copy blast radius to clipboard"
                onClick={() => {
                  const lines = [...blastRadius.members.entries()]
                    .sort((a, b) => a[1].hopDistance - b[1].hopDistance)
                    .map(([id, info]) => {
                      const node = nodes.find((n) => n.id === id)
                      return `${directionSymbol(info.direction)} [${info.hopDistance}] ${node?.label ?? id} (${node?.type ?? ''})`
                    })
                  void navigator.clipboard.writeText(
                    `Blast radius: ${blastRadiusId}\n\n${lines.join('\n')}`
                  )
                }}
              >
                📋
              </span>
            </span>
          )}

          {pathTraceId &&
            (() => {
              const src =
                pathTraceNodes.length > 0 ? nodes.find((n) => n.id === pathTraceNodes[0]) : null
              const tgt = nodes.find((n) => n.id === pathTraceId)
              return (
                <span
                  style={{ color: '#60a5fa', cursor: 'pointer' }}
                  onClick={() => setPathTraceId(null)}
                  title="Clear path trace"
                >
                  PATH · {src?.label ?? '?'} → {tgt?.label ?? pathTraceId} ✕
                </span>
              )
            })()}
        </div>
      )}

      <div className="w-full h-full">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(e: ReactMouseEvent, node) => {
            selectNode(node.id)
            if (e.shiftKey) {
              setPathTraceId(pathTraceId === node.id ? null : node.id)
            } else {
              // Re-anchor blast radius to the clicked node in the blast zone,
              // or toggle off if clicking the current source
              setBlastRadiusId(blastRadiusId === node.id ? null : node.id)
            }
          }}
          onNodeDoubleClick={(_e, node) => {
            setCommandFocusId(commandFocusId === node.id ? null : node.id)
          }}
          onPaneClick={() => {
            selectNode(null)
            setCommandFocusId(null)
            setBlastRadiusId(null)
            setPathTraceId(null)
          }}
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
