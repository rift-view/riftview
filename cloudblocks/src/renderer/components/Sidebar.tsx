import { useMemo } from 'react'
import { useUIStore } from '../store/ui'
import { useCloudStore } from '../store/cloud'
import type { NodeType } from '../types/cloud'

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

export function Sidebar(): React.JSX.Element {
  const view    = useUIStore((s) => s.view)
  const setView = useUIStore((s) => s.setView)
  const nodes   = useCloudStore((s) => s.nodes)

  const counts = useMemo(
    () => nodes.reduce<Record<string, number>>(
      (acc, n) => ({ ...acc, [n.type]: (acc[n.type] ?? 0) + 1 }),
      {},
    ),
    [nodes],
  )

  return (
    <div
      className="w-36 flex-shrink-0 flex flex-col py-2 overflow-y-auto"
      style={{ background: 'var(--cb-bg-panel)', borderRight: '1px solid var(--cb-border-strong)' }}
    >
      <div className="px-2.5 text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace' }}>
        Services
      </div>

      {SERVICES.map((s) => {
        const count = counts[s.type] ?? 0
        return (
          <div
            key={s.type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData('text/plain', s.type)}
            className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
            style={{
              background:     'var(--cb-bg-elevated)',
              border:         '1px solid var(--cb-border)',
              color:          'var(--cb-text-secondary)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⬡ {s.label}</span>
            {count > 0 && (
              <span
                style={{
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
                }}
              >
                {count}
              </span>
            )}
          </div>
        )
      })}

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
