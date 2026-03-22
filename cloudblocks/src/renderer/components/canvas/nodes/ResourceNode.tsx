import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus, NodeType } from '../../../types/cloud'

function driftStripeColor(driftStatus: import('../../../types/cloud').DriftStatus): string {
  switch (driftStatus) {
    case 'unmanaged': return '#f59e0b'
    case 'missing':   return '#ef4444'
    case 'matched':   return '#22c55e'
  }
}

function statusStripeColor(status: NodeStatus): string {
  switch (status) {
    case 'running':  return 'var(--cb-success, #22c55e)'
    case 'stopped':  return 'var(--cb-text-muted, #6b7280)'
    case 'pending':
    case 'creating': return 'var(--cb-warning, #f59e0b)'
    case 'error':
    case 'deleting': return 'var(--cb-error, #ef4444)'
    case 'imported': return '#7c3aed'
    case 'unknown':
    default:         return 'var(--cb-border, #374151)'
  }
}

const TYPE_BORDER = {
  ec2:              '#FF9900',
  vpc:              '#1976D2',
  subnet:           '#4CAF50',
  rds:              '#4CAF50',
  s3:               '#64b5f6',
  lambda:           '#64b5f6',
  alb:              '#FF9900',
  'security-group': '#9c27b0',
  igw:              '#4CAF50',
  acm:              '#64b5f6',
  cloudfront:       '#FF9900',
  apigw:            '#8b5cf6',
  'apigw-route':    '#22c55e',
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
  'unknown':         '#6b7280',
} satisfies Record<NodeType, string>

const TYPE_LABEL = {
  ec2:              'EC2',
  vpc:              'VPC',
  subnet:           'SUBNET',
  rds:              'RDS',
  s3:               'S3',
  lambda:           'λ',
  alb:              'ALB',
  'security-group': 'SG',
  igw:              'IGW',
  acm:              'ACM',
  cloudfront:       'CF',
  apigw:            'APIGW',
  'apigw-route':    'ROUTE',
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
  'unknown':         '?',
} satisfies Record<NodeType, string>

interface ResourceNodeData {
  label:        string
  nodeType:     NodeType
  status:       NodeStatus
  driftStatus?: import('../../../types/cloud').DriftStatus
  vpcLabel?:    string   // graph view only — VPC membership indicator
  vpcColor?:    string   // graph view only — color assigned to that VPC
  region?:      string   // shown as muted secondary label when node is not inside a VPC
  dimmed?:      boolean  // focus mode — node is not in the highlighted subgraph
  locked?:      boolean  // lock mode — node cannot be dragged or selected
  annotation?:  string  // user note — shows indicator badge if non-empty
}

export function ResourceNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as ResourceNodeData
  const borderColor = TYPE_BORDER[d.nodeType] ?? '#555'
  const stripeColor = d.driftStatus ? driftStripeColor(d.driftStatus) : statusStripeColor(d.status)
  const typeLabel   = TYPE_LABEL[d.nodeType] ?? d.nodeType.toUpperCase()
  const isImported  = d.status === 'imported'

  return (
    <div
      data-selected={selected}
      data-status={d.status}
      className={`relative rounded${d.status === 'creating' ? ' animate-pulse' : ''}`}
      style={{
        background:       'var(--cb-bg-panel)',
        border:           `${selected ? '2px' : '1px'} ${isImported ? 'dashed' : 'solid'} ${borderColor}`,
        borderLeft:       `3px ${isImported ? 'dashed' : 'solid'} ${stripeColor}`,
        boxShadow:        selected ? `0 0 10px ${borderColor}55` : 'none',
        fontFamily:  'monospace',
        minWidth:    130,
        padding:     '6px 10px 6px 8px',
        opacity:     d.dimmed ? 0.25 : d.locked ? 0.6 : 1,
        filter:      d.dimmed ? 'grayscale(60%)' : d.locked ? 'grayscale(30%)' : 'none',
        transition:  'opacity 0.2s, filter 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Annotation indicator — amber dot in top-right, non-interactive */}
      {d.annotation && (
        <span
          style={{
            position:      'absolute',
            top:           4,
            right:         4,
            width:         7,
            height:        7,
            borderRadius:  '50%',
            background:    '#f59e0b',
            pointerEvents: 'none',
          }}
          title={d.annotation}
        />
      )}

      {/* Type label row */}
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] font-bold tracking-wider"
          style={{ color: borderColor, opacity: 0.85 }}
        >
          {typeLabel}
        </span>
        {d.locked && (
          <span style={{ fontSize: 8, color: 'var(--cb-text-muted)', marginLeft: 'auto' }}>🔒</span>
        )}
      </div>

      {/* Resource label */}
      <div
        className="text-[11px] font-medium leading-tight"
        title={d.label}
        style={{ color: 'var(--cb-text-primary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
            title={d.vpcLabel}
            style={{ color: d.vpcColor ?? '#1976D2', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {d.vpcLabel}
          </span>
        </div>
      )}

      {/* Region label — shown only when not inside a VPC container */}
      {!d.vpcLabel && d.region && (
        <div
          className="mt-1"
          style={{ fontSize: 8, color: 'var(--cb-text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
        >
          {d.region}
        </div>
      )}

      {/* TF badge — shown for imported nodes */}
      {isImported && (
        <div style={{
          position: 'absolute',
          top: -6,
          right: -6,
          background: '#7c3aed',
          color: '#fff',
          fontSize: 8,
          fontWeight: 700,
          padding: '1px 4px',
          borderRadius: 3,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}>
          TF
        </div>
      )}

      {/* Drift badge — shows drift status relative to Terraform state */}
      {d.driftStatus && (
        <div
          title={
            d.driftStatus === 'unmanaged' ? 'Unmanaged — not in Terraform state' :
            d.driftStatus === 'missing'   ? 'Missing — declared in Terraform but not in live AWS' :
                                            'Matched — found in both live AWS and Terraform state'
          }
          style={{
            position:     'absolute',
            top:          -6,
            right:        isImported ? 14 : -6,
            background:   d.driftStatus === 'unmanaged' ? '#f59e0b' :
                          d.driftStatus === 'missing'   ? '#ef4444' : '#22c55e',
            color:        d.driftStatus === 'unmanaged' ? '#000' : '#fff',
            fontSize:     8,
            fontWeight:   700,
            padding:      '1px 4px',
            borderRadius: 3,
            zIndex:       2,
          }}
        >
          {d.driftStatus === 'unmanaged' ? '!' : d.driftStatus === 'missing' ? '✕' : '✓'}
        </div>
      )}
    </div>
  )
}
