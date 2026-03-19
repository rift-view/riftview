import { useState } from 'react'
import { useUIStore } from '../../store/ui'

interface Props {
  x: number
  y: number
  onClose: () => void
}

const CREATABLE = [
  { resource: 'vpc',        label: 'New VPC' },
  { resource: 'ec2',        label: 'New EC2 Instance' },
  { resource: 'sg',         label: 'New Security Group' },
  { resource: 's3',         label: 'New S3 Bucket' },
  { resource: 'rds',        label: 'New RDS Instance' },
  { resource: 'lambda',     label: 'New Lambda Function' },
  { resource: 'alb',        label: 'New ALB' },
  { resource: 'acm',        label: 'New ACM Certificate' },
  { resource: 'cloudfront', label: 'New CloudFront Distribution' },
  { resource: 'apigw',      label: 'New API Gateway' },
] as const

export function CanvasContextMenu({ x, y, onClose }: Props): React.JSX.Element {
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const [pendingResource, setPendingResource] = useState<string | null>(null)

  const menuStyle: React.CSSProperties = {
    position: 'fixed', top: y, left: x,
    background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-accent)', borderRadius: '4px',
    fontFamily: 'monospace', fontSize: '10px', zIndex: 1000, minWidth: '160px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  }

  function hoverOn(e: React.MouseEvent<HTMLDivElement>): void {
    (e.currentTarget as HTMLDivElement).style.background = 'var(--cb-bg-elevated)'
    ;(e.currentTarget as HTMLDivElement).style.color = 'var(--cb-accent)'
  }
  function hoverOff(e: React.MouseEvent<HTMLDivElement>): void {
    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
    ;(e.currentTarget as HTMLDivElement).style.color = 'var(--cb-text-secondary)'
  }

  const itemStyle: React.CSSProperties = { padding: '5px 10px', color: 'var(--cb-text-secondary)', cursor: 'pointer' }
  const sectionLabel: React.CSSProperties = { padding: '4px 10px 2px', color: 'var(--cb-text-muted)', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }

  function selectView(view: 'topology' | 'graph'): void {
    if (!pendingResource) return
    setActiveCreate({ resource: pendingResource, view })
    onClose()
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div style={menuStyle}>
        {!pendingResource ? (
          <>
            <div style={sectionLabel}>Create Resource</div>
            {CREATABLE.map((item) => (
              <div
                key={item.resource}
                style={itemStyle}
                onClick={() => setPendingResource(item.resource)}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                + {item.label}
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={sectionLabel}>Add to View</div>
            {(['topology', 'graph'] as const).map((v) => (
              <div
                key={v}
                style={itemStyle}
                onClick={() => selectView(v)}
                onMouseEnter={hoverOn}
                onMouseLeave={hoverOff}
              >
                {v === 'topology' ? '⊞' : '◈'} {v.charAt(0).toUpperCase() + v.slice(1)}
              </div>
            ))}
            <div
              style={{ ...itemStyle, borderTop: '1px solid var(--cb-border-strong)', color: 'var(--cb-text-muted)' }}
              onClick={() => setPendingResource(null)}
              onMouseEnter={hoverOn}
              onMouseLeave={hoverOff}
            >
              ← Back
            </div>
          </>
        )}
      </div>
    </>
  )
}
