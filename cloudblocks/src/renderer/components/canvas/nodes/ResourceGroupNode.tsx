import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeType } from '../../../types/cloud'
import { useUIStore } from '../../../store/ui'

// Minimal subset of TYPE_BORDER/TYPE_LABEL — sourced from ResourceNode.tsx.
// Kept here to avoid a circular import from ResourceNode.
const TYPE_BORDER: Partial<Record<string, string>> = {
  ec2:              '#FF9900',
  rds:              '#4CAF50',
  s3:               '#64b5f6',
  lambda:           '#64b5f6',
  alb:              '#FF9900',
  'security-group': '#9c27b0',
  igw:              '#4CAF50',
  acm:              '#64b5f6',
  cloudfront:       '#FF9900',
  apigw:            '#8b5cf6',
  sqs:              '#FF9900',
  secret:           '#22c55e',
  'ecr-repo':       '#FF9900',
  sns:              '#FF9900',
  dynamo:           '#64b5f6',
  'ssm-param':      '#22c55e',
  'nat-gateway':    '#4CAF50',
  'r53-zone':       '#FF9900',
  sfn:              '#FF9900',
  'eventbridge-bus': '#FF9900',
  ses:               '#FF9900',
  cognito:           '#FF9900',
  kinesis:           '#8b5cf6',
  ecs:               '#FF9900',
  elasticache:       '#22c55e',
}

const TYPE_LABEL: Partial<Record<string, string>> = {
  ec2:              'EC2',
  rds:              'RDS',
  s3:               'S3',
  lambda:           'λ',
  alb:              'ALB',
  'security-group': 'SG',
  igw:              'IGW',
  acm:              'ACM',
  cloudfront:       'CF',
  apigw:            'APIGW',
  sqs:              'SQS',
  secret:           'SECRET',
  'ecr-repo':       'ECR',
  sns:              'SNS',
  dynamo:           'DDB',
  'ssm-param':      'SSM',
  'nat-gateway':    'NAT',
  'r53-zone':       'R53',
  sfn:              'SFN',
  'eventbridge-bus': 'EB',
  ses:               'SES',
  cognito:           'COGNITO',
  kinesis:           'KDS',
  ecs:               'ECS',
  elasticache:       'REDIS',
}

interface ResourceGroupNodeData {
  nodeType: NodeType
  count:    number
  dimmed?:  boolean
}

export function ResourceGroupNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as ResourceGroupNodeData
  const pluginMeta  = useUIStore.getState().pluginNodeTypes[d.nodeType]
  const borderColor = TYPE_BORDER[d.nodeType] ?? pluginMeta?.borderColor ?? '#6b7280'
  const typeLabel   = TYPE_LABEL[d.nodeType] ?? pluginMeta?.label ?? d.nodeType.toUpperCase()

  return (
    <div
      data-selected={selected}
      style={{
        position:   'relative',
        background: 'var(--cb-bg-panel)',
        border:     `${selected ? '2px' : '1px'} solid ${borderColor}`,
        borderLeft: `3px solid #22c55e`,
        borderRadius: 4,
        fontFamily: 'monospace',
        minWidth:   130,
        padding:    '6px 10px 6px 8px',
        opacity:    d.dimmed ? 0.25 : 1,
        filter:     d.dimmed ? 'grayscale(60%)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s',
        boxShadow: selected
          ? `0 0 10px ${borderColor}55, 3px 3px 0 var(--cb-bg-elevated), 6px 6px 0 var(--cb-bg-elevated)`
          : `2px 2px 0 var(--cb-bg-elevated), 4px 4px 0 var(--cb-bg-elevated)`,
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Type label row */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] font-bold tracking-wider"
          style={{ color: borderColor, opacity: 0.85 }}
        >
          {typeLabel}
        </span>
      </div>

      {/* Count */}
      <div
        className="text-[11px] font-medium leading-tight"
        style={{ color: 'var(--cb-text-primary)' }}
      >
        × {d.count}
      </div>
    </div>
  )
}
