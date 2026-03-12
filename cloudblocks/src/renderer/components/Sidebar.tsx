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

export function Sidebar(): JSX.Element {
  const view    = useCloudStore((s) => s.view)
  const setView = useCloudStore((s) => s.setView)

  return (
    <div
      className="w-36 flex-shrink-0 flex flex-col py-2 overflow-y-auto"
      style={{ background: '#0d1117', borderRight: '1px solid #1e2d40' }}
    >
      <div className="px-2.5 text-[9px] uppercase tracking-widest mb-1" style={{ color: '#555', fontFamily: 'monospace' }}>
        Services
      </div>

      {SERVICES.map((s) => (
        <div
          key={s.type}
          // TODO M2-polish: wire drag-and-drop (Approach A from design spec)
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', s.type)}
          className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
          style={{ background: '#111', border: '1px solid #222', color: '#aaa' }}
        >
          ⬡ {s.label}
        </div>
      ))}

      <div className="px-2.5 text-[9px] uppercase tracking-widest mt-3 mb-1" style={{ color: '#555', fontFamily: 'monospace' }}>
        Views
      </div>

      {(['topology', 'graph'] as const).map((v) => (
        <div
          key={v}
          onClick={() => setView(v)}
          className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-pointer"
          style={{
            background: view === v ? '#1a2332' : '#111',
            border: `1px solid ${view === v ? '#64b5f6' : '#222'}`,
            color: view === v ? '#64b5f6' : '#aaa',
          }}
        >
          {v === 'topology' ? '⊞' : '◈'} {v.charAt(0).toUpperCase() + v.slice(1)}
        </div>
      ))}
    </div>
  )
}
