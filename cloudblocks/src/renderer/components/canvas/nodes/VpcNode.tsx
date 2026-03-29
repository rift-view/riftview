import type { NodeProps } from '@xyflow/react'

interface VpcNodeData {
  label:             string
  cidr?:             string
  collapsed?:        boolean
  childCount?:       number
  onToggleCollapse?: () => void
}

export function VpcNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as VpcNodeData
  return (
    <div
      style={{
        background:   'rgba(25, 118, 210, 0.04)',
        border:       '1px solid rgba(25, 118, 210, 0.5)',
        borderRadius: 8,
        minWidth:     200,
        minHeight:    d.collapsed ? 48 : 120,
        fontFamily:   'monospace',
        overflow:     'hidden',
        width:        '100%',
        height:       '100%',
        boxSizing:    'border-box',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background:   'rgba(25, 118, 210, 0.12)',
          borderBottom: '1px solid rgba(25, 118, 210, 0.3)',
          padding:      '5px 10px',
          display:      'flex',
          alignItems:   'center',
          gap:          8,
        }}
      >
        {d.onToggleCollapse && (
          <button
            onClick={(e) => { e.stopPropagation(); d.onToggleCollapse!() }}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    '0 2px',
              color:      '#90caf9',
              fontSize:   10,
              lineHeight: 1,
            }}
          >
            {d.collapsed ? '▶' : '▼'}
          </button>
        )}
        <span style={{ color: '#1976D2', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
          VPC
        </span>
        <span style={{ color: '#90caf9', fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        {d.collapsed && d.childCount !== undefined && (
          <span style={{ color: '#1976D280', fontSize: 9 }}>
            {d.childCount} resources
          </span>
        )}
        {!d.collapsed && d.cidr && (
          <span style={{ color: '#1976D280', fontSize: 9 }}>
            {d.cidr}
          </span>
        )}
      </div>
    </div>
  )
}
