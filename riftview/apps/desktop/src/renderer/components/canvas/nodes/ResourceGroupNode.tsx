import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeType } from '@riftview/shared'
import { useUIStore } from '../../../store/ui'
import { useShallow } from 'zustand/react/shallow'

// Minimal subset of TYPE_LABEL — sourced from ResourceNode.tsx.
// Kept here to avoid a circular import from ResourceNode.
const TYPE_LABEL: Partial<Record<string, string>> = {
  ec2: 'EC2',
  rds: 'RDS',
  s3: 'S3',
  lambda: 'λ',
  alb: 'ALB',
  'security-group': 'SG',
  igw: 'IGW',
  acm: 'ACM',
  cloudfront: 'CF',
  apigw: 'APIGW',
  sqs: 'SQS',
  secret: 'SECRET',
  'ecr-repo': 'ECR',
  sns: 'SNS',
  dynamo: 'DDB',
  'ssm-param': 'SSM',
  'nat-gateway': 'NAT',
  'r53-zone': 'R53',
  sfn: 'SFN',
  'eventbridge-bus': 'EB',
  ses: 'SES',
  cognito: 'COGNITO',
  kinesis: 'KDS',
  ecs: 'ECS',
  elasticache: 'REDIS'
}

interface ResourceGroupNodeData {
  nodeType: NodeType
  count: number
  dimmed?: boolean
}

export function ResourceGroupNode({ data, selected, id }: NodeProps): React.JSX.Element {
  const d = data as unknown as ResourceGroupNodeData
  const pluginMeta = useUIStore.getState().pluginNodeTypes[d.nodeType]
  const typeLabel = TYPE_LABEL[d.nodeType] ?? pluginMeta?.label ?? d.nodeType.toUpperCase()
  const isExpanded = useUIStore(useShallow((s) => s.expandedGroups.has(id)))
  const toggleExpand = useUIStore((s) => s.toggleGroupExpand)

  return (
    <div
      className="rift-zone"
      data-selected={selected}
      data-node-type={d.nodeType}
      onClick={(e) => {
        e.stopPropagation()
        toggleExpand(id)
      }}
      title={
        isExpanded
          ? `Collapse ${d.count} ${typeLabel} nodes`
          : `Expand ${d.count} ${typeLabel} nodes`
      }
      style={{
        minWidth: 130,
        padding: '18px 12px 10px 12px',
        cursor: 'pointer',
        opacity: d.dimmed ? 0.25 : 1,
        filter: d.dimmed ? 'grayscale(60%)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
        outline: selected ? '1px solid var(--fg-muted)' : 'none',
        outlineOffset: selected ? 2 : 0
      }}
    >
      <span className="rift-container-label">{`${typeLabel} · × ${d.count}`}</span>

      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Expand indicator */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--fg-default)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          lineHeight: 1.2
        }}
      >
        <span>× {d.count}</span>
        <span style={{ fontSize: 8, color: 'var(--fg-muted)', marginLeft: 2 }}>
          {isExpanded ? '▾' : '▸'}
        </span>
      </div>
    </div>
  )
}
