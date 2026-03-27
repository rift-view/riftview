import { useMemo, useState, useEffect } from 'react'
import { useUIStore } from '../store/ui'
import { useCloudStore } from '../store/cloud'
import { useCliStore } from '../store/cli'
import type { NodeType, CloudNode } from '../types/cloud'
import SidebarFilterDialog from './modals/SidebarFilterDialog'
import { SCAN_KEY_TO_TYPE } from '../utils/scanKeyMap'

const TYPE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2', rds: 'RDS', s3: 'S3', lambda: 'Lambda',
  alb: 'ALB', 'security-group': 'Security Group', igw: 'IGW',
}

const SERVICES: { type: NodeType; label: string; hasCreate: boolean; resource?: string }[] = [
  { type: 'vpc',            label: 'VPC',             hasCreate: true },
  { type: 'ec2',            label: 'EC2',             hasCreate: true },
  { type: 'rds',            label: 'RDS',             hasCreate: true },
  { type: 's3',             label: 'S3',              hasCreate: true },
  { type: 'lambda',         label: 'Lambda',          hasCreate: true },
  { type: 'alb',            label: 'ALB',             hasCreate: true },
  { type: 'security-group', label: 'Security Group',  hasCreate: true,  resource: 'sg' },
  { type: 'acm',            label: 'ACM',             hasCreate: true },
  { type: 'cloudfront',     label: 'CloudFront',      hasCreate: true },
  { type: 'apigw',          label: 'API Gateway',     hasCreate: true },
  { type: 'sqs',            label: 'SQS',             hasCreate: true },
  { type: 'sns',            label: 'SNS',             hasCreate: true },
  { type: 'dynamo',         label: 'DynamoDB',        hasCreate: true },
  { type: 'secret',         label: 'Secrets Manager', hasCreate: true },
  { type: 'ecr-repo',       label: 'ECR',             hasCreate: true,  resource: 'ecr' },
  { type: 'sfn',            label: 'Step Functions',  hasCreate: true },
  { type: 'eventbridge-bus', label: 'EventBridge',   hasCreate: true },
  { type: 'igw',            label: 'IGW',             hasCreate: false },
  { type: 'subnet',         label: 'Subnet',          hasCreate: false },
  { type: 'nat-gateway',    label: 'NAT Gateway',     hasCreate: false },
  { type: 'r53-zone',       label: 'Route 53',        hasCreate: false },
  { type: 'apigw-route',    label: 'API Route',       hasCreate: false },
]


function getSsmPrefix(label: string): string {
  if (!label.startsWith('/')) return '(ungrouped)'
  const secondSlash = label.indexOf('/', 1)
  if (secondSlash === -1) return label
  return label.slice(0, secondSlash)
}

interface SsmGroup {
  prefix: string
  nodes: CloudNode[]
}

export function Sidebar(): React.JSX.Element {
  const view              = useUIStore((s) => s.view)
  const setView           = useUIStore((s) => s.setView)
  const expandedSsmGroups = useUIStore((s) => s.expandedSsmGroups)
  const toggleSsmGroup    = useUIStore((s) => s.toggleSsmGroup)
  const sidebarFilter     = useUIStore((s) => s.sidebarFilter)
  const setSidebarFilter  = useUIStore((s) => s.setSidebarFilter)
  const nodes             = useCloudStore((s) => s.nodes)
  const scanErrors        = useCloudStore((s) => s.scanErrors)
  const settings          = useCloudStore((s) => s.settings)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)

  const pluginNodeTypes   = useUIStore((s) => s.pluginNodeTypes)

  const [filterTarget, setFilterTarget] = useState<NodeType | null>(null)

  useEffect(() => {
    if (!sidebarFilter) {
      setCommandPreview([])
      setPendingCommand(null)
    }
  }, [sidebarFilter, setCommandPreview, setPendingCommand])

  const counts = useMemo(
    () => nodes.reduce<Record<string, number>>(
      (acc, n) => ({ ...acc, [n.type]: (acc[n.type] ?? 0) + 1 }),
      {},
    ),
    [nodes],
  )

  const ssmGroups = useMemo<SsmGroup[]>(() => {
    const ssmNodes = nodes.filter((n) => n.type === 'ssm-param')
    if (ssmNodes.length === 0) return []

    const byPrefix = new Map<string, CloudNode[]>()
    for (const node of ssmNodes) {
      const prefix = getSsmPrefix(node.label)
      const existing = byPrefix.get(prefix)
      if (existing) existing.push(node)
      else byPrefix.set(prefix, [node])
    }

    return Array.from(byPrefix.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, groupNodes]) => ({ prefix, nodes: groupNodes }))
  }, [nodes])

  const pluginServices = useMemo(
    () => Object.entries(pluginNodeTypes).filter(([, meta]) => meta.hasCreate),
    [pluginNodeTypes],
  )

  const errorsByType = useMemo<Map<NodeType, string>>(() => {
    const m = new Map<NodeType, string>()
    if (!settings.showScanErrorBadges) return m
    for (const err of scanErrors) {
      const nt = SCAN_KEY_TO_TYPE[err.service]
      if (!nt) continue
      const line = `[${err.service}] ${err.region} — ${err.message}`
      const existing = m.get(nt)
      m.set(nt, existing ? `${existing}\n${line}` : line)
    }
    return m
  }, [scanErrors, settings.showScanErrorBadges])

  const serviceRowStyle: React.CSSProperties = {
    background:     'var(--cb-bg-elevated)',
    border:         '1px solid var(--cb-border)',
    color:          'var(--cb-text-secondary)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
  }

  const badgeStyle: React.CSSProperties = {
    fontSize:     10,
    color:        'var(--cb-text-muted)',
    background:   'var(--cb-bg-elevated)',
    border:       '1px solid var(--cb-border)',
    borderRadius: 9999,
    padding:      '0 5px',
    minWidth:     16,
    textAlign:    'center',
    lineHeight:   '14px',
    flexShrink:   0,
  }

  const ssmErrTooltip = errorsByType.get('ssm-param' as NodeType)

  return (
    <div
      className="flex flex-col py-2 overflow-y-auto h-full"
      style={{ background: 'var(--cb-bg-panel)', borderRight: '1px solid var(--cb-border-strong)' }}
    >
      <div className="px-2.5 text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
        Services
      </div>

      {nodes.length === 0 && (
        <div className="px-2.5 mt-2 mb-3" style={{ fontFamily: 'monospace' }}>
          <div className="text-[8px] leading-relaxed" style={{ color: 'var(--cb-text-muted)' }}>
            Scan your AWS account to get started.
          </div>
          <div className="text-[7px] mt-1" style={{ color: 'var(--cb-text-muted)', opacity: 0.6 }}>
            Click ⟳ Scan in the toolbar
          </div>
        </div>
      )}

      {SERVICES.map((s) => {
        const count        = counts[s.type] ?? 0
        const isActive     = sidebarFilter === s.type
        const errTooltip   = errorsByType.get(s.type)
        const activeStyle: React.CSSProperties = {
          ...serviceRowStyle,
          border:     '1px solid var(--cb-accent)',
          color:      'var(--cb-accent)',
          background: 'var(--cb-bg-elevated)',
          cursor:     'pointer',
        }
        return (
          <div
            key={s.type}
            draggable={s.hasCreate}
            onDragStart={s.hasCreate ? (e) => e.dataTransfer.setData('text/plain', s.resource ?? s.type) : undefined}
            onClick={() => { if (sidebarFilter === s.type) setSidebarFilter(null); else setFilterTarget(s.type) }}
            className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono"
            style={{ ...(isActive ? activeStyle : serviceRowStyle), cursor: s.hasCreate ? 'grab' : 'default' }}
          >
            <span>
              ⬡ {s.label}
              {errTooltip && (
                <span title={errTooltip} style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>⚠</span>
              )}
            </span>
            {count > 0 && (
              <span style={badgeStyle}>
                {count}
              </span>
            )}
          </div>
        )
      })}

      {pluginServices.map(([type, meta]) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', type)}
          onClick={() => { /* plugin types skip the filter dialog for now */ }}
          className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono"
          style={{ ...serviceRowStyle, cursor: 'grab' }}
        >
          <span>⬡ {meta.displayName}</span>
        </div>
      ))}

      {(ssmGroups.length > 0 || ssmErrTooltip) && (
        <>
          <div
            className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1"
            style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span>Parameters</span>
            {ssmErrTooltip && (
              <span title={ssmErrTooltip} style={{ color: '#f59e0b', fontSize: 10 }}>⚠</span>
            )}
          </div>

          {ssmGroups.map(({ prefix, nodes: groupNodes }) => {
            if (groupNodes.length === 1) {
              // Single param — show ungrouped
              const node = groupNodes[0]
              return (
                <div
                  key={node.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                  className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                  style={serviceRowStyle}
                  title={node.label}
                >
                  <span className="truncate">⬡ {node.label}</span>
                </div>
              )
            }

            const isExpanded = expandedSsmGroups.has(prefix)
            return (
              <div key={prefix}>
                {/* Group header */}
                <div
                  onClick={() => toggleSsmGroup(prefix)}
                  className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-pointer"
                  style={{
                    color:          'var(--cb-text-muted)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span className="truncate">{isExpanded ? '⊟' : '⊞'} {prefix}/</span>
                  <span style={badgeStyle}>{groupNodes.length}</span>
                </div>

                {/* Expanded param rows */}
                {isExpanded && groupNodes
                  .slice()
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((node) => (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                      className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                      style={{ ...serviceRowStyle, paddingLeft: 16 }}
                      title={node.label}
                    >
                      <span className="truncate">⬡ {node.label}</span>
                    </div>
                  ))}
              </div>
            )
          })}
        </>
      )}

      <div className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
        Views
      </div>

      {(['topology', 'graph'] as const).map((v) => (
        <div
          key={v}
          onClick={() => setView(v)}
          className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-pointer"
          style={{
            background: view === v ? 'var(--cb-bg-elevated)' : 'transparent',
            border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`,
            color: view === v ? '#64b5f6' : 'var(--cb-text-secondary)',
          }}
        >
          {v === 'topology' ? '⊞' : '◈'} {v.charAt(0).toUpperCase() + v.slice(1)}
        </div>
      ))}

      {filterTarget && (
        <SidebarFilterDialog
          type={filterTarget}
          count={counts[filterTarget] ?? 0}
          onClose={() => setFilterTarget(null)}
          onConfirm={() => {
            const label = TYPE_LABELS[filterTarget] ?? filterTarget.toUpperCase()
            const count = counts[filterTarget] ?? 0
            setSidebarFilter(filterTarget)
            setCommandPreview([`[Filter] ${label} · ${count} node${count === 1 ? '' : 's'}`])
            setPendingCommand(null)
            setFilterTarget(null)
          }}
        />
      )}
    </div>
  )
}
