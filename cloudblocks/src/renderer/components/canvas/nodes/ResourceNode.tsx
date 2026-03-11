import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus, NodeType } from '../../../types/cloud'

const STATUS_COLORS: Record<NodeStatus, string> = {
  running: '#28c840',
  stopped: '#ff5f57',
  pending: '#febc2e',
  error:   '#ff5f57',
  unknown: '#666666',
}

const TYPE_BORDER: Record<NodeType, string> = {
  ec2:            '#FF9900',
  vpc:            '#1976D2',
  subnet:         '#4CAF50',
  rds:            '#4CAF50',
  s3:             '#64b5f6',
  lambda:         '#64b5f6',
  alb:            '#FF9900',
  'security-group': '#9c27b0',
  igw:            '#4CAF50',
}

interface ResourceNodeData {
  label:    string
  nodeType: NodeType
  status:   NodeStatus
}

export function ResourceNode({ data, selected }: NodeProps) {
  const d = data as ResourceNodeData
  const borderColor = TYPE_BORDER[d.nodeType] ?? '#555'
  const statusColor = STATUS_COLORS[d.status] ?? '#666'

  return (
    <div
      data-selected={selected}
      className="relative px-3 py-1.5 rounded min-w-[80px] text-center"
      style={{
        background: '#0d1117',
        border: `${selected ? '2.5px' : '1.5px'} solid ${borderColor}`,
        boxShadow: selected ? `0 0 8px ${borderColor}66` : 'none',
        fontFamily: 'monospace',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Status dot */}
      <div
        data-status={d.status}
        className="absolute top-1 right-1 w-2 h-2 rounded-full"
        style={{ background: statusColor }}
      />

      <div className="text-[9px] font-bold" style={{ color: borderColor }}>
        {d.label}
      </div>
    </div>
  )
}
