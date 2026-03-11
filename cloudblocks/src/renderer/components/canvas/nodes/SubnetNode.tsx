import type { NodeProps } from '@xyflow/react'

interface SubnetNodeData { label: string; isPublic?: boolean }

export function SubnetNode({ data }: NodeProps) {
  const d = data as SubnetNodeData
  const color = d.isPublic ? '#4CAF50' : '#f44336'
  return (
    <div
      className="rounded p-2"
      style={{
        background: `${color}0d`,
        border: `1px solid ${color}`,
        minWidth: 140,
        minHeight: 80,
        fontFamily: 'monospace',
      }}
    >
      <div className="text-[8px]" style={{ color }}>{d.label}</div>
    </div>
  )
}
