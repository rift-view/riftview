import type { NodeProps } from '@xyflow/react'

interface SubnetNodeData {
  label: string
  isPublic?: boolean
  az?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function SubnetNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as SubnetNodeData
  const subnetType = d.isPublic ? 'Public' : 'Private'
  const labelParts = [`${subnetType} · ${d.label}`]
  if (d.az && !d.collapsed) labelParts.push(d.az)

  return (
    <div
      className="rift-subnet"
      style={{
        minWidth: 140,
        minHeight: d.collapsed ? 32 : 80,
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      <span className="rift-container-label">{labelParts.join(' · ')}</span>

      {/* Invisible drag handle along the top edge */}
      <div
        className="cb-zone-drag-handle"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 6,
          cursor: 'move'
        }}
        title="Drag header to move subnet"
      >
        {d.onToggleCollapse && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              d.onToggleCollapse!()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '0 2px',
              lineHeight: 1
            }}
            title={d.collapsed ? 'Expand subnet' : 'Collapse subnet'}
          >
            {d.collapsed ? '▶' : '▼'}
          </button>
        )}
      </div>
    </div>
  )
}
