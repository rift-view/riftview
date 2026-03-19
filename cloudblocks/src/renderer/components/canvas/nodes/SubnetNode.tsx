import type { NodeProps } from '@xyflow/react'

interface SubnetNodeData { label: string; isPublic?: boolean; az?: string }

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
        minHeight:    80,
        fontFamily:   'monospace',
        overflow:     'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background:   `${color}14`,
          borderBottom: `1px solid ${color}44`,
          padding:      '4px 8px',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
        }}
      >
        <span
          style={{
            color:        color,
            fontSize:     8,
            fontWeight:   700,
            letterSpacing: '0.1em',
            background:   `${color}22`,
            border:       `1px solid ${color}44`,
            borderRadius: 2,
            padding:      '1px 4px',
          }}
        >
          {tag}
        </span>
        <span style={{ color: `${color}cc`, fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {d.label}
        </span>
        {d.az && (
          <span style={{ color: `${color}80`, fontSize: 8, flexShrink: 0 }}>
            {d.az}
          </span>
        )}
      </div>
    </div>
  )
}
