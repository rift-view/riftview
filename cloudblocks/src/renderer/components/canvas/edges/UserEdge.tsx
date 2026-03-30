import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react'
import { useState } from 'react'
import { useUIStore } from '../../../store/ui'
import type { CustomEdgeColor } from '../../../types/cloud'

const COLORS: CustomEdgeColor[] = ['#f59e0b', '#14b8a6', '#6366f1', '#22c55e', '#ef4444', '#8b5cf6']

export interface UserEdgeData extends Record<string, unknown> {
  isCustom: true
  color: CustomEdgeColor
  label?: string
}

export default function UserEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  selected, data,
}: EdgeProps): React.JSX.Element {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const edgeData = data as UserEdgeData | undefined
  const color    = edgeData?.color ?? '#8b5cf6'
  const label    = edgeData?.label

  const updateLabel = useUIStore((s) => s.updateCustomEdgeLabel)
  const updateColor = useUIStore((s) => s.updateCustomEdgeColor)
  const removeEdge  = useUIStore((s) => s.removeCustomEdge)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(label ?? '')
  const { setEdges } = useReactFlow()

  const persist = (): void => {
    void window.cloudblocks.saveCustomEdges(useUIStore.getState().customEdges)
  }

  const handleColorChange = (newColor: CustomEdgeColor): void => {
    updateColor(id, newColor)
    setEdges((eds) => eds.map((e) => e.id === id ? { ...e, data: { ...(e.data ?? {}), color: newColor } } : e))
    persist()
  }

  const handleLabelCommit = (): void => {
    setEditing(false)
    updateLabel(id, draft)
    setEdges((eds) => eds.map((e) => e.id === id ? { ...e, data: { ...(e.data ?? {}), label: draft } } : e))
    persist()
  }

  const handleDelete = (): void => {
    removeEdge(id)
    setEdges((eds) => eds.filter((e) => e.id !== id))
    persist()
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: selected ? 2.5 : 1.5, opacity: selected ? 1 : 0.8 }}
      />
      {label && !selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 9, fontFamily: 'monospace',
              background: 'var(--cb-bg-panel)',
              border: `1px solid ${color}`,
              borderRadius: 3, padding: '1px 5px',
              color, pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'var(--cb-bg-panel)',
              border: `1px solid ${color}`,
              borderRadius: 5, padding: '4px 6px',
              display: 'flex', flexDirection: 'column', gap: 4,
              pointerEvents: 'all', zIndex: 100,
            }}
            className="nodrag nopan"
          >
            <div style={{ display: 'flex', gap: 3 }}>
              {COLORS.map((c) => (
                <div
                  key={c}
                  onClick={() => handleColorChange(c)}
                  style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: c, cursor: 'pointer',
                    border: c === color ? '2px solid white' : '1px solid transparent',
                  }}
                />
              ))}
            </div>
            {editing ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleLabelCommit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLabelCommit() }}
                style={{
                  fontSize: 9, fontFamily: 'monospace',
                  background: 'var(--cb-bg-elevated)',
                  border: `1px solid ${color}`,
                  color: 'var(--cb-text-primary)',
                  borderRadius: 3, padding: '1px 4px', outline: 'none', width: 80,
                }}
              />
            ) : (
              <div
                onClick={() => { setDraft(label ?? ''); setEditing(true) }}
                style={{
                  fontSize: 9, fontFamily: 'monospace',
                  color: label ? color : 'var(--cb-text-muted)',
                  cursor: 'text', minWidth: 60,
                }}
              >
                {label || 'add label\u2026'}
              </div>
            )}
            <div
              onClick={handleDelete}
              style={{ fontSize: 8, color: '#ef4444', cursor: 'pointer', textAlign: 'center' }}
            >
              &#x2715; delete
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
