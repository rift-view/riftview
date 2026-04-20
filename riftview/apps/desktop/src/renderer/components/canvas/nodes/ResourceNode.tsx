import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useState, useEffect } from 'react'
import type { NodeStatus, NodeType } from '@riftview/shared'
import { useUIStore } from '../../../store/ui'
import { useCloudStore } from '../../../store/cloud'
import { ActionRail } from './ActionRail'
import { analyzeNode } from '@riftview/shared'

interface CloudMetric {
  name: string
  value: number
  unit: string
}

const METRIC_TYPES = new Set<NodeType>(['lambda', 'rds', 'ecs'])

const TYPE_LABEL = {
  ec2: 'EC2',
  vpc: 'VPC',
  subnet: 'SUBNET',
  rds: 'RDS',
  s3: 'S3',
  lambda: 'λ',
  alb: 'ALB',
  'security-group': 'SG',
  igw: 'IGW',
  acm: 'ACM',
  cloudfront: 'CF',
  apigw: 'APIGW',
  'apigw-route': 'ROUTE',
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
  elasticache: 'REDIS',
  eks: 'EKS',
  opensearch: 'OS',
  msk: 'MSK',
  unknown: '?'
} satisfies Record<NodeType, string>

interface BlastInfo {
  hop: number
  direction: 'source' | 'upstream' | 'downstream' | 'both'
  edgeTypes: string[]
}

interface ResourceNodeData {
  label: string
  nodeType: NodeType
  status: NodeStatus
  driftStatus?: import('@riftview/shared').DriftStatus
  vpcLabel?: string // graph view only — VPC membership indicator
  vpcColor?: string // graph view only — color assigned to that VPC
  region?: string // shown as muted secondary label when node is not inside a VPC
  dimmed?: boolean // focus mode — node is not in the highlighted subgraph
  locked?: boolean // lock mode — node cannot be dragged or selected
  annotation?: string // user note — shows indicator badge if non-empty
  regionColor?: string // multi-region accent strip on left edge
  subscribers?: string[] // SNS only — subscriber node labels
  metadata?: Record<string, unknown> // raw node metadata for inline hint display
  blastInfo?: BlastInfo // blast radius — hop distance + direction badge
}

function getNodeMeta(nodeType: NodeType, m: Record<string, unknown>): string | undefined {
  switch (nodeType) {
    case 'ec2':
      return m.instanceType as string | undefined
    case 'lambda':
      return m.runtime as string | undefined
    case 'rds':
      return m.engine as string | undefined
    case 'eks':
      return m.version ? `k8s ${m.version as string}` : undefined
    case 'elasticache':
      return (m.engine as string | undefined) ?? 'redis'
    case 'ecs':
      return m.launchType as string | undefined
    case 'kinesis':
      return m.streamMode as string | undefined
    case 'dynamo':
      return m.billingMode as string | undefined
    case 'sqs':
      return typeof m.messages === 'number' && m.messages > 0 ? `${m.messages} msg` : undefined
    case 'alb':
      return m.type as string | undefined
    case 'msk':
      return (m.instanceType as string | undefined) ?? (m.clusterType as string | undefined)
    case 'opensearch':
      return m.engineVersion as string | undefined
    case 'ssm-param':
      return m.type as string | undefined
    case 'sfn':
      return m.type as string | undefined
    case 'eventbridge-bus':
      return typeof m.ruleCount === 'number' && m.ruleCount > 0 ? `${m.ruleCount} rules` : undefined
    case 'apigw':
      return m.protocolType as string | undefined
    default:
      return undefined
  }
}

function statusDotClass(status: NodeStatus): string {
  switch (status) {
    case 'running':
      return '-ok'
    case 'pending':
    case 'creating':
      return '-pending'
    case 'error':
    case 'deleting':
      return '-err'
    case 'stopped':
    case 'unknown':
      return '-neutral'
    case 'imported':
      return '-warn'
    default:
      return '-neutral'
  }
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function ResourceNode({ id, data, selected, dragging }: NodeProps): React.JSX.Element {
  const d = data as unknown as ResourceNodeData

  // CloudWatch metric badges — only for lambda, rds, ecs
  const [metrics, setMetrics] = useState<CloudMetric[]>([])
  useEffect(() => {
    if (!METRIC_TYPES.has(d.nodeType as NodeType)) return

    const resourceId: string = (() => {
      const m = d.metadata ?? {}
      if (d.nodeType === 'lambda') return (m.functionName as string | undefined) ?? d.label
      if (d.nodeType === 'rds') return (m.dbInstanceId as string | undefined) ?? d.label
      // ecs
      return (
        ((m.clusterName as string | undefined) ?? '') +
        '/' +
        ((m.serviceName as string | undefined) ?? '')
      )
    })()

    const profile = useCloudStore.getState().profile
    const region = d.region ?? useCloudStore.getState().region

    function doFetch(): void {
      if (typeof window !== 'undefined' && window.riftview) {
        window.riftview
          .fetchMetrics({ nodeId: id, nodeType: d.nodeType, resourceId, region, profile })
          .then(setMetrics)
          .catch(() => {})
      }
    }

    doFetch()
    const timer = setInterval(doFetch, 60_000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, d.nodeType, d.label, d.region])

  const pluginMeta = useUIStore.getState().pluginNodeTypes[d.nodeType]
  const typeLabel =
    (TYPE_LABEL as Record<string, string>)[d.nodeType] ??
    pluginMeta?.label ??
    d.nodeType.toUpperCase()
  const isImported = d.status === 'imported'
  const meta = d.metadata ? getNodeMeta(d.nodeType, d.metadata) : undefined

  const advisoryBadge = d.metadata
    ? (() => {
        const advisories = analyzeNode({
          id,
          type: d.nodeType,
          label: d.label,
          status: d.status,
          region: d.region ?? '',
          metadata: d.metadata
        })
        const critical = advisories.filter((a) => a.severity === 'critical').length
        const warning = advisories.filter((a) => a.severity === 'warning').length
        if (critical === 0 && warning === 0) return null
        return { critical, warning }
      })()
    : null

  // Pending/creating states use shimmer + dim via rift-node--pending class;
  // stopped/deleting still need their own opacity/animation tweaks.
  const extraStyle: React.CSSProperties = (() => {
    switch (d.status) {
      case 'stopped':
        return { opacity: d.dimmed ? 0.25 : 0.5 }
      case 'deleting':
        return { animation: 'cb-fade-pulse 1.5s ease-in-out infinite' }
      default:
        return {}
    }
  })()

  return (
    <div
      data-selected={selected}
      data-status={d.status}
      data-node-type={d.nodeType}
      data-node-id={id}
      className={cx(
        'rift-node',
        selected && 'rift-node--focused',
        (d.status === 'pending' || d.status === 'creating') && 'rift-node--pending',
        d.status === 'error' && 'rift-node--error',
        isImported && 'rift-node--imported',
        d.status === 'creating' && 'animate-pulse'
      )}
      style={{
        minWidth: 150,
        opacity: d.dimmed ? 0.25 : d.locked ? 0.6 : undefined,
        filter: d.dimmed ? 'grayscale(60%)' : d.locked ? 'grayscale(30%)' : undefined,
        transition: 'opacity 0.2s, filter 0.2s',
        ...extraStyle
      }}
    >
      {/* STATUS_LANGUAGE shimmer — pending/creating loading sweep */}
      {(d.status === 'pending' || d.status === 'creating') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            borderRadius: 'inherit'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              background:
                'linear-gradient(90deg, transparent, oklch(0.73 0.170 50 / 0.18), transparent)',
              animation: 'cb-shimmer 1.8s ease-in-out infinite'
            }}
          />
        </div>
      )}

      {/* ACTION_RAIL — hover action strip, hidden while dragging */}
      {!dragging && (
        <ActionRail
          node={{
            id: id,
            type: d.nodeType,
            label: d.label,
            status: d.status,
            region: d.region ?? '',
            metadata: d.metadata ?? {}
          }}
          onToast={(msg, type) => useUIStore.getState().showToast(msg, type)}
        />
      )}

      <Handle id="top" type="target" position={Position.Top} className="cb-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="cb-handle" />
      <Handle id="left" type="target" position={Position.Left} className="cb-handle" />
      <Handle id="right" type="source" position={Position.Right} className="cb-handle" />

      {/* Region accent strip — 3px left-edge color band for multi-region views */}
      {d.regionColor && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
            background: d.regionColor,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* Annotation indicator — amber dot in top-right, non-interactive */}
      {d.annotation && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--ember-500)',
            pointerEvents: 'none'
          }}
          title={d.annotation}
        />
      )}

      {/* Blast radius direction badge — top-right monospace symbol */}
      {d.blastInfo && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: d.annotation ? 14 : 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--ember-400)',
            pointerEvents: 'none',
            lineHeight: 1
          }}
          title={`hop ${d.blastInfo.hop} · ${d.blastInfo.direction}${d.blastInfo.edgeTypes.length > 0 ? ` · ${d.blastInfo.edgeTypes.join(', ')}` : ''}`}
        >
          {d.blastInfo.direction === 'source'
            ? '●'
            : d.blastInfo.direction === 'upstream'
              ? '↑'
              : d.blastInfo.direction === 'downstream'
                ? '↓'
                : '↕'}
        </span>
      )}

      {/* Eye — monospace uppercase type label */}
      <div className="rift-node-eye">
        {typeLabel}
        {d.locked && <span style={{ marginLeft: 6, opacity: 0.7 }}>🔒</span>}
      </div>

      {/* Title — display-font resource label */}
      <div
        className="rift-node-title"
        title={d.label}
        style={{
          maxWidth: 160,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: d.status === 'unknown' ? 'italic' : undefined
        }}
      >
        {d.label}
      </div>

      <hr className="rift-node-rule" />

      {/* Meta row — status dot + label + optional compact detail */}
      <div className="rift-node-meta">
        <span className={cx('dot', statusDotClass(d.status))} aria-hidden="true" />
        <span className="rift-node-status">{d.status}</span>
        {meta && (
          <>
            <span className="sep" aria-hidden="true">
              ·
            </span>
            <span
              title={meta}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 100
              }}
            >
              {meta}
            </span>
          </>
        )}
      </div>

      {/* VPC badge — graph view only */}
      {d.vpcLabel && (
        <div
          className="mt-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5"
          style={{
            background: `${d.vpcColor ?? 'var(--oxide-400)'}18`,
            border: `1px solid ${d.vpcColor ?? 'var(--oxide-400)'}55`
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: d.vpcColor ?? 'var(--oxide-400)' }}
          />
          <span
            className="text-[8px] tracking-wide"
            title={d.vpcLabel}
            style={{
              color: d.vpcColor ?? 'var(--oxide-400)',
              maxWidth: 110,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {d.vpcLabel}
          </span>
        </div>
      )}

      {/* Region label — shown only when not inside a VPC container */}
      {!d.vpcLabel && d.region && (
        <div
          className="mt-1"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--fg-dim)',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap'
          }}
        >
          {d.region}
        </div>
      )}

      {/* SNS subscriber badge */}
      {d.subscribers && d.subscribers.length > 0 && (
        <div className="mt-1" style={{ position: 'relative', display: 'inline-block' }}>
          <span
            className="sns-sub-badge"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--moss-500)',
              cursor: 'default',
              letterSpacing: '0.03em',
              userSelect: 'none'
            }}
            title={d.subscribers.join('\n')}
          >
            ↓ {d.subscribers.length} subscriber{d.subscribers.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* CloudWatch metric badges — lambda, rds, ecs only */}
      {metrics.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 6,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--ink-700)',
            paddingTop: 6
          }}
        >
          {metrics.map((m) => (
            <span
              key={m.name}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fg-muted)',
                background: 'var(--ink-800)',
                borderRadius: 3,
                padding: '1px 4px',
                whiteSpace: 'nowrap'
              }}
            >
              {m.name}{' '}
              <span style={{ color: 'var(--bone-200)', fontWeight: 600 }}>
                {m.value}
                {m.unit}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* TF badge — shown for imported nodes */}
      {isImported && (
        <div
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--oxide-400)',
            color: 'var(--ink-1000)',
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            fontWeight: 700,
            padding: '1px 4px',
            borderRadius: 3,
            letterSpacing: '0.05em',
            zIndex: 2
          }}
        >
          TF
        </div>
      )}

      {/* Drift badge — shows drift status relative to Terraform state */}
      {d.driftStatus && (
        <div
          title={
            d.driftStatus === 'unmanaged'
              ? 'Unmanaged — not in Terraform state'
              : d.driftStatus === 'missing'
                ? 'Missing — declared in Terraform but not in live AWS'
                : 'Matched — found in both live AWS and Terraform state'
          }
          style={{
            position: 'absolute',
            top: -6,
            right: isImported ? 14 : -6,
            background:
              d.driftStatus === 'unmanaged'
                ? 'var(--ember-500)'
                : d.driftStatus === 'missing'
                  ? 'var(--fault-500)'
                  : 'var(--moss-500)',
            color: d.driftStatus === 'unmanaged' ? 'var(--ink-1000)' : 'var(--bone-50)',
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            fontWeight: 700,
            padding: '1px 4px',
            borderRadius: 3,
            zIndex: 2
          }}
        >
          {d.driftStatus === 'unmanaged' ? '!' : d.driftStatus === 'missing' ? '✕' : '✓'}
        </div>
      )}

      {/* Advisory badge — shows OP_INTELLIGENCE findings; "!" glyph,
          with accessible label + detailed count in title */}
      {advisoryBadge &&
        (() => {
          const parts: string[] = []
          if (advisoryBadge.critical > 0) parts.push(`${advisoryBadge.critical} critical`)
          if (advisoryBadge.warning > 0) parts.push(`${advisoryBadge.warning} warning`)
          const badgeTitle = parts.join(', ')
          return (
            <div
              className="advisory-badge"
              aria-label={badgeTitle || 'advisories'}
              title={badgeTitle}
            >
              !
            </div>
          )
        })()}
    </div>
  )
}
