import { NodeResizer, type NodeProps } from '@xyflow/react'

interface RegionZoneData {
  label: string
  color?: string
  onResizeEnd: (id: string, width: number, height: number) => void
}

export function RegionZoneNode({ id, data }: NodeProps): React.JSX.Element {
  const d = data as unknown as RegionZoneData
  const borderColor = d.color ?? 'rgba(255,153,0,0.4)'
  const bgColor = d.color ? 'rgba(255,255,255,0.015)' : 'rgba(255,153,0,0.05)'
  const labelColor = d.color ?? 'rgba(255,153,0,0.8)'
  return (
    <div
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        minWidth: 200,
        minHeight: 80,
        fontFamily: 'monospace',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      <NodeResizer
        color={borderColor}
        minWidth={200}
        minHeight={80}
        onResizeEnd={(_e, params) => d.onResizeEnd(id, params.width, params.height)}
      />
      <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {d.color && (
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }}
          />
        )}
        <span
          style={{
            fontSize: 9,
            color: labelColor,
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}
        >
          {`⬡ ${d.label}`}
        </span>
      </div>
    </div>
  )
}
