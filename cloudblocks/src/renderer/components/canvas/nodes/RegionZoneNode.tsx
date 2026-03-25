import type { NodeProps } from '@xyflow/react'

interface RegionZoneData {
  label: string
  color?: string
}

export function RegionZoneNode({ data }: NodeProps): React.JSX.Element {
  const d = data as unknown as RegionZoneData
  return (
    <div
      style={{
        background:    'rgba(255,255,255,0.015)',
        border:        `1px dashed ${d.color ?? 'var(--cb-border)'}`,
        borderRadius:  8,
        minWidth:      200,
        minHeight:     80,
        fontFamily:    'monospace',
        overflow:      'hidden',
        pointerEvents: 'none',
      }}
    >
      <div style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        {d.color && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 9, color: d.color ?? 'var(--cb-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {d.label}
        </span>
      </div>
    </div>
  )
}
