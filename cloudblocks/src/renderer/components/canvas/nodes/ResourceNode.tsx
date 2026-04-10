import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus, NodeType } from '../../../types/cloud'
import { useUIStore } from '../../../store/ui'
import { flag } from '../../../utils/flags'
import { ActionRail } from './ActionRail'
import { analyzeNode } from '../../../utils/analyzeNode'

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
  ses:               '#FF9900',
  cognito:           '#FF9900',
  kinesis:           '#8b5cf6',
  ecs:               '#FF9900',
  elasticache:       '#22c55e',
  eks:               '#FF9900',
  opensearch:        '#005EB8',
  msk:               '#FF9900',
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
  ses:               'SES',
  cognito:           'COGNITO',
  kinesis:           'KDS',
  ecs:               'ECS',
  elasticache:       'REDIS',
  eks:               'EKS',
  opensearch:        'OS',
  msk:               'MSK',
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
  regionColor?: string  // multi-region accent strip on left edge
  subscribers?: string[]  // SNS only — subscriber node labels
  metadata?:    Record<string, unknown>  // raw node metadata for inline hint display
}

function getNodeMeta(nodeType: NodeType, m: Record<string, unknown>): string | undefined {
  switch (nodeType) {
    case 'ec2':             return m.instanceType as string | undefined
    case 'lambda':          return m.runtime as string | undefined
    case 'rds':             return m.engine as string | undefined
    case 'eks':             return m.version ? `k8s ${m.version as string}` : undefined
    case 'elasticache':     return (m.engine as string | undefined) ?? 'redis'
    case 'ecs':             return m.launchType as string | undefined
    case 'kinesis':         return m.streamMode as string | undefined
    case 'dynamo':          return m.billingMode as string | undefined
    case 'sqs':             return typeof m.messages === 'number' && m.messages > 0 ? `${m.messages} msg` : undefined
    case 'alb':             return m.type as string | undefined
    case 'msk':             return (m.instanceType as string | undefined) ?? (m.clusterType as string | undefined)
    case 'opensearch':      return m.engineVersion as string | undefined
    case 'ssm-param':       return m.type as string | undefined
    case 'sfn':             return m.type as string | undefined
    case 'eventbridge-bus': return typeof m.ruleCount === 'number' && m.ruleCount > 0 ? `${m.ruleCount} rules` : undefined
    case 'apigw':           return m.protocolType as string | undefined
    default:                return undefined
  }
}

export function ResourceNode({ id, data, selected, dragging }: NodeProps): React.JSX.Element {
  const d = data as unknown as ResourceNodeData
  const pluginMeta  = useUIStore.getState().pluginNodeTypes[d.nodeType]
  const borderColor = (TYPE_BORDER as Record<string, string>)[d.nodeType] ?? pluginMeta?.borderColor ?? '#555'
  const stripeColor = d.driftStatus ? driftStripeColor(d.driftStatus) : statusStripeColor(d.status)
  const typeLabel   = (TYPE_LABEL as Record<string, string>)[d.nodeType] ?? pluginMeta?.label ?? d.nodeType.toUpperCase()
  const isImported  = d.status === 'imported'
  const meta        = d.metadata ? getNodeMeta(d.nodeType, d.metadata) : undefined
  const actionRail  = flag('ACTION_RAIL')
  const opIntelligence = flag('OP_INTELLIGENCE')

  const advisoryBadge = opIntelligence && d.metadata ? (() => {
    const advisories = analyzeNode({
      id,
      type:     d.nodeType,
      label:    d.label,
      status:   d.status,
      region:   d.region ?? '',
      metadata: d.metadata,
    })
    const critical = advisories.filter((a) => a.severity === 'critical').length
    const warning  = advisories.filter((a) => a.severity === 'warning').length
    if (critical === 0 && warning === 0) return null
    return { critical, warning }
  })() : null

  const statusLang = flag('STATUS_LANGUAGE')

  const statusLangStyle: React.CSSProperties = statusLang ? (() => {
    switch (d.status) {
      case 'error':
        return { animation: 'cb-pulse-error 2s ease-in-out infinite' }
      case 'stopped':
        return { opacity: d.dimmed ? 0.25 : 0.5 }
      case 'deleting':
        return { animation: 'cb-fade-pulse 1.5s ease-in-out infinite' }
      default:
        return {}
    }
  })() : {}

  return (
    <div
      data-selected={selected}
      data-status={d.status}
      className={`resource-node relative rounded${d.status === 'creating' ? ' animate-pulse' : ''}`}
      style={{
        background:   'var(--cb-bg-panel)',
        border:       `${selected ? '2px' : '1px'} ${isImported ? 'dashed' : 'solid'} ${stripeColor}`,
        boxShadow:    selected ? `0 0 10px ${stripeColor}55` : 'none',
        fontFamily:   'monospace',
        minWidth:     130,
        padding:      '6px 10px 6px 8px',
        opacity:      d.dimmed ? 0.25 : d.locked ? 0.6 : 1,
        filter:       d.dimmed ? 'grayscale(60%)' : d.locked ? 'grayscale(30%)' : 'none',
        transition:   'opacity 0.2s, filter 0.2s',
        ...statusLangStyle,
      }}
    >
      {/* STATUS_LANGUAGE shimmer — pending/creating loading sweep */}
      {statusLang && (d.status === 'pending' || d.status === 'creating') && (
        <div
          style={{
            position:      'absolute',
            inset:         0,
            overflow:      'hidden',
            pointerEvents: 'none',
            borderRadius:  'inherit',
          }}
        >
          <div
            style={{
              position:   'absolute',
              top:        0,
              bottom:     0,
              width:      '40%',
              background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.18), transparent)',
              animation:  'cb-shimmer 1.8s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* ACTION_RAIL — hover action strip, shown when flag on and node not being dragged */}
      {actionRail && !dragging && (
        <ActionRail
          node={{
            id:       id,
            type:     d.nodeType,
            label:    d.label,
            status:   d.status,
            region:   d.region ?? '',
            metadata: d.metadata ?? {},
          }}
          onToast={(msg, type) => useUIStore.getState().showToast(msg, type)}
        />
      )}

      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      {/* Region accent strip — 3px left-edge color band for multi-region views */}
      {d.regionColor && (
        <div
          style={{
            position:      'absolute',
            left:          0,
            top:           0,
            bottom:        0,
            width:         3,
            borderRadius:  '4px 0 0 4px',
            background:    d.regionColor,
            pointerEvents: 'none',
          }}
        />
      )}

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
        style={{
          color:        'var(--cb-text-primary)',
          maxWidth:     140,
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
          fontStyle:    statusLang && d.status === 'unknown' ? 'italic' : 'normal',
        }}
      >
        {d.label}
      </div>

      {/* Metadata hint — key attribute for reference diagram clarity */}
      {meta && (
        <div
          className="mt-0.5"
          style={{ fontSize: 9, color: 'var(--cb-text-muted)', letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}
          title={meta}
        >
          {meta}
        </div>
      )}

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

      {/* SNS subscriber badge */}
      {d.subscribers && d.subscribers.length > 0 && (
        <div
          className="mt-1"
          style={{ position: 'relative', display: 'inline-block' }}
        >
          <span
            className="sns-sub-badge"
            style={{
              fontSize: 9,
              color: '#14b8a6',
              cursor: 'default',
              letterSpacing: '0.03em',
              userSelect: 'none',
            }}
            title={d.subscribers.join('\n')}
          >
            ↓ {d.subscribers.length} subscriber{d.subscribers.length !== 1 ? 's' : ''}
          </span>
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

      {/* Advisory badge — shows OP_INTELLIGENCE findings count */}
      {advisoryBadge && (() => {
        const parts: string[] = []
        if (advisoryBadge.critical > 0) parts.push(`${advisoryBadge.critical} critical`)
        if (advisoryBadge.warning > 0)  parts.push(`${advisoryBadge.warning} warning`)
        const badgeTitle = parts.join(', ')
        const rightOffset = (isImported && d.driftStatus) ? 54 : (isImported || d.driftStatus) ? 34 : -6
        return (
          <div
            title={badgeTitle}
            style={{
              position:      'absolute',
              top:           -6,
              right:         rightOffset,
              background:    advisoryBadge.critical > 0 ? '#ef4444' : '#f59e0b',
              color:         advisoryBadge.critical > 0 ? '#fff' : '#000',
              fontSize:      8,
              fontWeight:    700,
              padding:       '1px 4px',
              borderRadius:  3,
              zIndex:        3,
              lineHeight:    1.4,
              pointerEvents: 'none',
            }}
          >
            {advisoryBadge.critical > 0 ? `⚠ ${advisoryBadge.critical}` : `! ${advisoryBadge.warning}`}
          </div>
        )
      })()}
    </div>
  )
}
