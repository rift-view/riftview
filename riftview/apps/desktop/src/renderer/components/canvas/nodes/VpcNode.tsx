import type { NodeProps } from '@xyflow/react'

interface VpcNodeData {
  label: string
  cidr?: string
  collapsed?: boolean
  childCount?: number
  onToggleCollapse?: () => void
}

export function VpcNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as VpcNodeData
  const labelParts = [`VPC · ${d.label}`]
  if (d.cidr && !d.collapsed) labelParts.push(d.cidr)
  if (d.collapsed && d.childCount !== undefined) labelParts.push(`${d.childCount} resources`)

  return (
    <div
      className="rift-vpc"
      style={{
        minWidth: 200,
        minHeight: d.collapsed ? 48 : 120,
        width: '100%',
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
          paddingRight: 8,
          cursor: 'move'
        }}
        title="Drag header to move VPC"
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
              padding: '0 2px',
              color: 'var(--fg-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              lineHeight: 1
            }}
            title={d.collapsed ? 'Expand VPC' : 'Collapse VPC'}
          >
            {d.collapsed ? '▶' : '▼'}
          </button>
        )}
      </div>
    </div>
  )
}
