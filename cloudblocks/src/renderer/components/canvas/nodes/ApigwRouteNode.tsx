import { Handle, Position, type NodeProps } from '@xyflow/react'

interface ApigwRouteNodeData {
  label:      string
  method?:    string
  path?:      string
  hasLambda?: boolean
  dimmed?:    boolean
}

const METHOD_COLORS: Record<string, string> = {
  GET:    '#22c55e',
  POST:   '#3b82f6',
  PUT:    '#f97316',
  PATCH:  '#eab308',
  DELETE: '#ef4444',
  ANY:    '#6b7280',
}

export function ApigwRouteNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as ApigwRouteNodeData

  // Parse method + path from label if not provided directly
  const label = d.label ?? ''
  const spaceIdx = label.indexOf(' ')
  const method = d.method ?? (spaceIdx >= 0 ? label.slice(0, spaceIdx) : label)
  const path   = d.path   ?? (spaceIdx >= 0 ? label.slice(spaceIdx + 1) : '/')

  const methodColor = METHOD_COLORS[method.toUpperCase()] ?? '#6b7280'

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        background:   'var(--cb-bg-panel)',
        border:       `${selected ? '2px' : '1px'} solid ${methodColor}55`,
        borderLeft:   `3px solid ${methodColor}`,
        borderRadius: 4,
        padding:      '4px 8px',
        fontFamily:   'monospace',
        height:       36,
        boxSizing:    'border-box',
        minWidth:     140,
        boxShadow:    selected ? `0 0 8px ${methodColor}44` : 'none',
        opacity:      d.dimmed ? 0.25 : 1,
        filter:       d.dimmed ? 'grayscale(60%)' : 'none',
        transition:   'opacity 0.2s, filter 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Method badge */}
      <span
        style={{
          background:   `${methodColor}22`,
          border:       `1px solid ${methodColor}66`,
          borderRadius: 3,
          padding:      '1px 4px',
          fontSize:     8,
          fontWeight:   700,
          color:        methodColor,
          flexShrink:   0,
          letterSpacing: '0.05em',
        }}
      >
        {method}
      </span>

      {/* Path */}
      <span
        style={{
          fontSize:     9,
          color:        'var(--cb-text-muted)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          flex:         1,
        }}
      >
        {path}
      </span>

      {/* Lambda indicator */}
      {d.hasLambda && (
        <span style={{ fontSize: 9, color: '#64b5f6', flexShrink: 0 }}>λ</span>
      )}
    </div>
  )
}
