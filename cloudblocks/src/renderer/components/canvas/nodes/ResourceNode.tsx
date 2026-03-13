import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus, NodeType } from '../../../types/cloud'

const STATUS_COLORS: Record<NodeStatus, string> = {
  running:  '#28c840',
  stopped:  '#ff5f57',
  pending:  '#febc2e',
  error:    '#ff5f57',
  unknown:  '#666666',
  creating: '#febc2e',
}

const TYPE_BORDER: Record<NodeType, string> = {
  ec2:              '#FF9900',
  vpc:              '#1976D2',
  subnet:           '#4CAF50',
  rds:              '#4CAF50',
  s3:               '#64b5f6',
  lambda:           '#64b5f6',
  alb:              '#FF9900',
  'security-group': '#9c27b0',
  igw:              '#4CAF50',
}

const TYPE_LABEL: Record<NodeType, string> = {
  ec2:              'EC2',
  vpc:              'VPC',
  subnet:           'SUBNET',
  rds:              'RDS',
  s3:               'S3',
  lambda:           'λ',
  alb:              'ALB',
  'security-group': 'SG',
  igw:              'IGW',
}

interface ResourceNodeData {
  label:      string
  nodeType:   NodeType
  status:     NodeStatus
  vpcLabel?:  string   // graph view only — VPC membership indicator
  vpcColor?:  string   // graph view only — color assigned to that VPC
}

export function ResourceNode({ data, selected }: NodeProps) {
  const d = data as unknown as ResourceNodeData
  const borderColor = TYPE_BORDER[d.nodeType] ?? '#555'
  const statusColor = STATUS_COLORS[d.status] ?? '#666'
  const typeLabel   = TYPE_LABEL[d.nodeType] ?? d.nodeType.toUpperCase()

  return (
    <div
      data-selected={selected}
      className="relative rounded"
      style={{
        background:  '#0d1117',
        border:      `${selected ? '2px' : '1px'} solid ${borderColor}`,
        boxShadow:   selected ? `0 0 10px ${borderColor}55` : 'none',
        fontFamily:  'monospace',
        minWidth:    130,
        padding:     '6px 10px 6px 10px',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Type label + status dot on same row */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] font-bold tracking-wider"
          style={{ color: borderColor, opacity: 0.85 }}
        >
          {typeLabel}
        </span>
        <span
          data-status={d.status}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: statusColor }}
        />
      </div>

      {/* Resource label */}
      <div
        className="text-[11px] font-medium leading-tight"
        style={{ color: '#d0d8e4', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {d.label}
      </div>

      {/* VPC badge — graph view only */}
      {d.vpcLabel && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5"
          style={{
            background: `${d.vpcColor ?? '#1976D2'}18`,
            border:     `1px solid ${d.vpcColor ?? '#1976D2'}55`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: d.vpcColor ?? '#1976D2' }}
          />
          <span
            className="text-[8px] tracking-wide"
            style={{ color: d.vpcColor ?? '#1976D2', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {d.vpcLabel}
          </span>
        </div>
      )}
    </div>
  )
}
