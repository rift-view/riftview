import React, { useState, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'
import type { EdgeType, IntegrationEdgeData } from '../../../types/cloud'

type IntegrationEdgeType = Edge<IntegrationEdgeData, 'integration'>

// eslint-disable-next-line react-refresh/only-export-components
export const EDGE_TYPE_STYLES: Record<EdgeType, { color: string; label: string }> = {
  trigger:      { color: '#f59e0b', label: 'triggers' },
  subscription: { color: '#14b8a6', label: 'subscribes to' },
  origin:       { color: '#6366f1', label: 'serves' },
}

const ANIMATION_DURATION: Record<EdgeType, string> = {
  trigger:      '1s',
  subscription: '1.5s',
  origin:       '2s',
}

// Inject the dash-flow keyframe once into the document head
let styleInjected = false
function ensureStyle(): void {
  if (styleInjected || typeof document === 'undefined') return
  styleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    @keyframes dash-flow {
      to { stroke-dashoffset: -18; }
    }
  `
  document.head.appendChild(style)
}

export default function IntegrationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<IntegrationEdgeType>): React.JSX.Element {
  useEffect(() => { ensureStyle() }, [])

  const edgeType: EdgeType = data?.edgeType ?? 'trigger'
  const { color, label } = EDGE_TYPE_STYLES[edgeType]
  const duration = ANIMATION_DURATION[edgeType]

  const [hovered, setHovered] = useState(false)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      {/* Invisible wider hit area for hover detection */}
      <path
        id={`${id}-hover`}
        d={edgePath}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: 1.5,
          strokeDasharray: '6 3',
          animation: `dash-flow ${duration} linear infinite`,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'none',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
            background: 'var(--cb-surface, #1e1e2e)',
            color: color,
            border: `1px solid ${color}`,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
          className="nodrag nopan"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
