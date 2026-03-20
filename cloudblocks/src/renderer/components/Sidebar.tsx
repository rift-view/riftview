import { useMemo } from 'react'
import { useUIStore } from '../store/ui'
import { useCloudStore } from '../store/cloud'
import type { NodeType, CloudNode } from '../types/cloud'

const SERVICES: { type: NodeType; label: string }[] = [
  { type: 'vpc',            label: 'VPC' },
  { type: 'ec2',            label: 'EC2' },
  { type: 'rds',            label: 'RDS' },
  { type: 's3',             label: 'S3' },
  { type: 'lambda',         label: 'Lambda' },
  { type: 'alb',            label: 'ALB' },
  { type: 'security-group', label: 'Security Group' },
  { type: 'igw',            label: 'IGW' },
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
  const nodes             = useCloudStore((s) => s.nodes)

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

  return (
    <div
      className="w-36 flex-shrink-0 flex flex-col py-2 overflow-y-auto"
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
        const count = counts[s.type] ?? 0
        return (
          <div
            key={s.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', s.type)}
            className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
            style={serviceRowStyle}
          >
            <span>⬡ {s.label}</span>
            {count > 0 && (
              <span style={badgeStyle}>
                {count}
              </span>
            )}
          </div>
        )
      })}

      {ssmGroups.length > 0 && (
        <>
          <div className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
            Parameters
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
    </div>
  )
}
