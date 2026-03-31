import { useMemo, useState, useEffect } from 'react'
import { useUIStore } from '../store/ui'
import { useCloudStore } from '../store/cloud'
import { useCliStore } from '../store/cli'
import type { NodeType, CloudNode } from '../types/cloud'
import SidebarFilterDialog from './modals/SidebarFilterDialog'
import { SCAN_KEY_TO_TYPE } from '../utils/scanKeyMap'

type ServiceDef = { type: NodeType; label: string; hasCreate: boolean; resource?: string }

const CATEGORIES: { label: string; services: ServiceDef[] }[] = [
  { label: 'Compute', services: [
    { type: 'ec2',    label: 'EC2',    hasCreate: true },
    { type: 'lambda', label: 'Lambda', hasCreate: true },
  ]},
  { label: 'Networking', services: [
    { type: 'vpc',            label: 'VPC',            hasCreate: true },
    { type: 'subnet',         label: 'Subnet',         hasCreate: false },
    { type: 'security-group', label: 'Security Group', hasCreate: true, resource: 'sg' },
    { type: 'igw',            label: 'IGW',            hasCreate: false },
    { type: 'nat-gateway',    label: 'NAT Gateway',    hasCreate: false },
  ]},
  { label: 'Storage', services: [
    { type: 's3', label: 'S3', hasCreate: true },
  ]},
  { label: 'Database', services: [
    { type: 'rds',    label: 'RDS',      hasCreate: true },
    { type: 'dynamo', label: 'DynamoDB', hasCreate: true },
  ]},
  { label: 'Messaging', services: [
    { type: 'sqs',             label: 'SQS',         hasCreate: true },
    { type: 'sns',             label: 'SNS',         hasCreate: true },
    { type: 'eventbridge-bus', label: 'EventBridge', hasCreate: true },
  ]},
  { label: 'Edge & API', services: [
    { type: 'cloudfront',  label: 'CloudFront',  hasCreate: true },
    { type: 'apigw',       label: 'API Gateway', hasCreate: true },
    { type: 'apigw-route', label: 'API Route',   hasCreate: false },
  ]},
  { label: 'Security', services: [
    { type: 'acm',    label: 'ACM',             hasCreate: true },
    { type: 'secret', label: 'Secrets Manager', hasCreate: true },
  ]},
  { label: 'Management', services: [] }, // SSM only — rendered via ssmGroups below
  { label: 'Orchestration', services: [
    { type: 'sfn', label: 'Step Functions', hasCreate: true },
  ]},
  { label: 'Containers', services: [
    { type: 'ecr-repo', label: 'ECR', hasCreate: true, resource: 'ecr' },
  ]},
  { label: 'Load Balancing', services: [
    { type: 'alb', label: 'ALB', hasCreate: true },
  ]},
  { label: 'DNS', services: [
    { type: 'r53-zone', label: 'Route 53', hasCreate: false },
  ]},
]

function getTypeLabel(type: NodeType): string {
  for (const cat of CATEGORIES) {
    const svc = cat.services.find((s) => s.type === type)
    if (svc) return svc.label
  }
  return type.toUpperCase()
}

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
  const activeSidebarType = useUIStore((s) => s.activeSidebarType)
  const addFilter         = useUIStore((s) => s.addFilter)
  const removeFilter      = useUIStore((s) => s.removeFilter)
  const setSidebarType    = useUIStore((s) => s.setSidebarType)
  const nodes             = useCloudStore((s) => s.nodes)
  const scanErrors        = useCloudStore((s) => s.scanErrors)
  const settings          = useCloudStore((s) => s.settings)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)
  const pluginNodeTypes   = useUIStore((s) => s.pluginNodeTypes)

  const [filterTarget, setFilterTarget] = useState<NodeType | null>(null)

  // All categories start expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(CATEGORIES.map((c) => c.label))
  )
  function toggleCategory(label: string): void {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const sidebarFilterActive = activeSidebarType !== null

  useEffect(() => {
    if (!sidebarFilterActive) {
      setCommandPreview([])
      setPendingCommand(null)
    }
  }, [sidebarFilterActive, setCommandPreview, setPendingCommand])

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

      {/* Service categories */}
      {CATEGORIES.map((cat) => {
        const isManagement = cat.label === 'Management'
        const catCount = cat.services.reduce((sum, s) => sum + (counts[s.type] ?? 0), 0)
          + (isManagement ? nodes.filter((n) => n.type === 'ssm-param').length : 0)
        const isExpanded = expandedCategories.has(cat.label)

        return (
          <div key={cat.label}>
            {/* Category header */}
            <div
              onClick={() => toggleCategory(cat.label)}
              className="flex items-center justify-between mx-1.5 mb-0.5 px-2 py-1 rounded cursor-pointer text-[9px] font-mono uppercase tracking-widest"
              style={{ color: 'var(--cb-text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cb-bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span>{isExpanded ? '⊟' : '⊞'} {cat.label}</span>
              {catCount > 0 && <span style={badgeStyle}>{catCount}</span>}
            </div>

            {/* Category items */}
            {isExpanded && (
              <>
                {cat.services.map((s) => {
                  const count      = counts[s.type] ?? 0
                  const isActive   = activeSidebarType === s.type
                  const errTooltip = errorsByType.get(s.type)
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
                      onClick={() => { if (isActive) { removeFilter('sidebar-type') } else setFilterTarget(s.type) }}
                      className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono"
                      style={{ ...(isActive ? activeStyle : serviceRowStyle), cursor: s.hasCreate ? 'grab' : 'default', paddingLeft: 20 }}
                    >
                      <span>
                        ⬡ {s.label}
                        {errTooltip && (
                          <span title={errTooltip} style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>⚠</span>
                        )}
                      </span>
                      {count > 0 && <span style={badgeStyle}>{count}</span>}
                    </div>
                  )
                })}

                {/* Management: SSM sub-groups rendered inline */}
                {isManagement && (ssmGroups.length > 0 || ssmErrTooltip) && (
                  <>
                    {ssmErrTooltip && (
                      <div className="mx-1.5 px-2.5 text-[9px] font-mono" style={{ color: '#f59e0b' }}>
                        <span title={ssmErrTooltip}>⚠ SSM error</span>
                      </div>
                    )}
                    {ssmGroups.map(({ prefix, nodes: groupNodes }) => {
                      if (groupNodes.length === 1) {
                        const node = groupNodes[0]
                        return (
                          <div
                            key={node.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                            className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                            style={{ ...serviceRowStyle, paddingLeft: 20 }}
                            title={node.label}
                          >
                            <span className="truncate">⬡ {node.label}</span>
                          </div>
                        )
                      }

                      const isGroupExpanded = expandedSsmGroups.has(prefix)
                      return (
                        <div key={prefix}>
                          <div
                            onClick={() => toggleSsmGroup(prefix)}
                            className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-pointer"
                            style={{ color: 'var(--cb-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20 }}
                          >
                            <span className="truncate">{isGroupExpanded ? '⊟' : '⊞'} {prefix}/</span>
                            <span style={badgeStyle}>{groupNodes.length}</span>
                          </div>
                          {isGroupExpanded && groupNodes
                            .slice()
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((node) => (
                              <div
                                key={node.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                                className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                                style={{ ...serviceRowStyle, paddingLeft: 28 }}
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
              </>
            )}
          </div>
        )
      })}

      {/* Plugin services (always shown flat, no category) */}
      {pluginServices.length > 0 && (
        <>
          <div className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
            Plugins
          </div>
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
        </>
      )}

      {/* Views */}
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
            const label = getTypeLabel(filterTarget)
            const count = counts[filterTarget] ?? 0
            const type  = filterTarget
            addFilter({ id: 'sidebar-type', label, test: (n) => n.type === type })
            setSidebarType(type)
            setCommandPreview([`[Filter] ${label} · ${count} node${count === 1 ? '' : 's'}`])
            setPendingCommand(null)
            setFilterTarget(null)
          }}
        />
      )}
    </div>
  )
}
