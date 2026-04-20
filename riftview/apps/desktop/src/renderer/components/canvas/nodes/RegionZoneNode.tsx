import { NodeResizer, type NodeProps } from '@xyflow/react'

interface RegionZoneData {
  label: string
  color?: string
  onResizeEnd: (id: string, width: number, height: number) => void
}

export function RegionZoneNode({ id, data }: NodeProps): React.JSX.Element {
  const d = data as unknown as RegionZoneData
  const resizerColor = d.color ?? 'var(--container-vpc-stroke)'
  return (
    <div
      className="rift-zone"
      style={{
        minWidth: 200,
        minHeight: 80,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box'
      }}
    >
      <NodeResizer
        color={resizerColor}
        minWidth={200}
        minHeight={80}
        onResizeEnd={(_e, params) => d.onResizeEnd(id, params.width, params.height)}
      />
      <span className="rift-container-label">
        {d.color && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: d.color,
              marginRight: 6,
              verticalAlign: 'middle'
            }}
          />
        )}
        {`Region · ${d.label}`}
      </span>

      {/* Invisible drag handle along the top edge */}
      <div
        className="cb-zone-drag-handle"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 24,
          cursor: 'move'
        }}
        title="Drag header to move zone"
      />
    </div>
  )
}
