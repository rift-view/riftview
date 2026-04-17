import React from 'react'
import type { NodeType } from '../../types/cloud'

const TYPE_LABELS: Record<string, string> = {
  vpc: 'VPC',
  ec2: 'EC2',
  rds: 'RDS',
  s3: 'S3',
  lambda: 'Lambda',
  alb: 'ALB',
  'security-group': 'Security Group',
  igw: 'IGW'
}

interface SidebarFilterDialogProps {
  type: NodeType
  count: number
  onClose: () => void
  onConfirm: () => void
}

export default function SidebarFilterDialog({
  type,
  count,
  onClose,
  onConfirm
}: SidebarFilterDialogProps): React.JSX.Element {
  const label = TYPE_LABELS[type] ?? type.toUpperCase()

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200
  }

  const dialog: React.CSSProperties = {
    background: 'var(--cb-bg-panel)',
    border: '1px solid var(--cb-accent)',
    borderRadius: 8,
    padding: 20,
    width: 300,
    fontFamily: 'monospace'
  }

  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
    >
      <div style={dialog}>
        <div
          style={{ color: 'var(--cb-accent)', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}
        >
          Filter to [{label}] only?
        </div>
        <div style={{ color: 'var(--cb-text-secondary)', fontSize: 10, marginBottom: 16 }}>
          {count} node{count === 1 ? '' : 's'} will be highlighted
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--cb-bg-elevated)',
              border: '1px solid var(--cb-border)',
              borderRadius: 3,
              padding: '4px 14px',
              color: 'var(--cb-text-muted)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            autoFocus
            onClick={onConfirm}
            style={{
              background: 'var(--cb-accent)',
              border: '1px solid var(--cb-accent)',
              borderRadius: 3,
              padding: '4px 14px',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  )
}
