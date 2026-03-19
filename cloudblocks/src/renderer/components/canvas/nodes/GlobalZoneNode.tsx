import type { NodeProps } from '@xyflow/react'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GlobalZoneNode(_props: NodeProps): React.JSX.Element {
  return (
    <div
      style={{
        background:   'rgba(255,255,255,0.02)',
        border:       '1px dashed var(--cb-border)',
        borderRadius: 8,
        minWidth:     200,
        minHeight:    80,
        fontFamily:   'monospace',
        overflow:     'hidden',
        pointerEvents: 'none',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding:    '5px 10px',
          display:    'flex',
          alignItems: 'center',
          gap:        6,
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--cb-text-muted)', letterSpacing: '0.08em' }}>
          🌐 GLOBAL / EDGE
        </span>
      </div>
    </div>
  )
}
