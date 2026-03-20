import type { NodeProps } from '@xyflow/react'

interface SubnetNodeData {
  label:             string
  isPublic?:         boolean
  az?:               string
  collapsed?:        boolean
  onToggleCollapse?: () => void
}

export function SubnetNode({ data }: NodeProps): React.JSX.Element {
  const d     = data as unknown as SubnetNodeData
  const color = d.isPublic ? '#4CAF50' : '#78909c'
  const tag   = d.isPublic ? 'PUBLIC' : 'PRIVATE'

  return (
    <div
      style={{
        background:   `${color}09`,
        border:       `1px solid ${color}55`,
        borderRadius: 6,
        minWidth:     140,
        minHeight:    d.collapsed ? 32 : 80,
        fontFamily:   'monospace',
        overflow:     'hidden',
        height:       '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          background:   `${color}14`,
          borderBottom: d.collapsed ? 'none' : `1px solid ${color}44`,
          padding:      '4px 8px',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          height:       32,
          boxSizing:    'border-box',
        }}
      >
        {d.onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              d.onToggleCollapse!()
            }}
            style={{
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              color:      color,
              fontSize:   10,
              padding:    '0 2px',
              lineHeight: 1,
              flexShrink: 0,
              display:    'flex',
              alignItems: 'center',
            }}
            title={d.collapsed ? 'Expand subnet' : 'Collapse subnet'}
          >
            {d.collapsed ? '▶' : '▼'}
          </button>
        )}
        <span
          style={{
            color:         color,
            fontSize:      8,
            fontWeight:    700,
            letterSpacing: '0.1em',
            background:    `${color}22`,
            border:        `1px solid ${color}44`,
            borderRadius:  2,
            padding:       '1px 4px',
            flexShrink:    0,
          }}
        >
          {tag}
        </span>
        <span style={{ color: `${color}cc`, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {d.label}
        </span>
        {d.az && !d.collapsed && (
          <span style={{ color: `${color}80`, fontSize: 8, flexShrink: 0 }}>
            {d.az}
          </span>
        )}
      </div>
    </div>
  )
}
