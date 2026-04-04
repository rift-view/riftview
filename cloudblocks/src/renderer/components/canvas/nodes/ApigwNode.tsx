import type { NodeProps } from '@xyflow/react'

interface ApigwNodeData {
  label:             string
  endpoint?:         string
  collapsed?:        boolean
  onToggleCollapse?: () => void
  dimmed?:           boolean
}

export function ApigwNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as ApigwNodeData
  return (
    <div
      style={{
        background:   'rgba(139, 92, 246, 0.04)',
        border:       '1px solid rgba(139, 92, 246, 0.5)',
        borderRadius: 8,
        // width/height: 100% fills the React Flow wrapper in TopologyView
        // (wrapper gets explicit style.width/height from buildFlowNodes).
        // In GraphView the wrapper auto-sizes, so minWidth/minHeight take over.
        width:        '100%',
        height:       '100%',
        boxSizing:    'border-box',
        minWidth:     Math.max(280, d.label.length * 8 + 120),
        minHeight:    80,
        fontFamily:   'monospace',
        overflow:     'hidden',
        opacity:      d.dimmed ? 0.25 : 1,
        filter:       d.dimmed ? 'grayscale(60%)' : 'none',
        transition:   'opacity 0.2s, filter 0.2s',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          background:   'rgba(139, 92, 246, 0.12)',
          borderBottom: '1px solid rgba(139, 92, 246, 0.3)',
          padding:      '5px 10px',
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          height:       32,
          boxSizing:    'border-box',
        }}
      >
        <span style={{ color: '#8b5cf6', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
          ⚡ API GW
        </span>
        <span style={{ color: '#c4b5fd', fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); d.onToggleCollapse?.() }}
          title={d.collapsed ? 'Expand routes' : 'Collapse routes'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#c4b5fd', fontSize: 10, padding: '0 2px',
            lineHeight: 1, flexShrink: 0,
          }}
        >
          {d.collapsed ? '▸' : '▾'}
        </button>
      </div>
    </div>
  )
}
