import type { NodeProps } from '@xyflow/react'

interface VpcNodeData { label: string }

export function VpcNode({ data }: NodeProps) {
  const d = data as unknown as VpcNodeData
  return (
    <div
      className="rounded-lg p-2"
      style={{
        background: 'rgba(25, 118, 210, 0.05)',
        border: '1px dashed #1976D2',
        minWidth: 200,
        minHeight: 120,
        fontFamily: 'monospace',
      }}
    >
      <div className="text-[9px] font-bold" style={{ color: '#1976D2' }}>{d.label}</div>
    </div>
  )
}
