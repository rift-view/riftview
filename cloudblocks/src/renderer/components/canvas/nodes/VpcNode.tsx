import type { NodeProps } from '@xyflow/react'

interface VpcNodeData { label: string; cidr?: string }

export function VpcNode({ data }: NodeProps) {
  const d = data as unknown as VpcNodeData
  return (
    <div
      style={{
        background:   'rgba(25, 118, 210, 0.04)',
        border:       '1px solid rgba(25, 118, 210, 0.5)',
        borderRadius: 8,
        minWidth:     200,
        minHeight:    120,
        fontFamily:   'monospace',
        overflow:     'hidden',
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
        <span style={{ color: '#1976D2', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em' }}>
          VPC
        </span>
        <span style={{ color: '#90caf9', fontSize: 10, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        {d.cidr && (
          <span style={{ color: '#1976D280', fontSize: 9 }}>
            {d.cidr}
          </span>
        )}
      </div>
    </div>
  )
}
