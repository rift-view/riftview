import React from 'react'
import type { CloudNode } from '../../types/cloud'

interface NodeContextMenuProps {
  node: CloudNode
  x: number
  y: number
  onEdit: (node: CloudNode) => void
  onDelete: (node: CloudNode) => void
  onStop?: (node: CloudNode) => void
  onStart?: (node: CloudNode) => void
  onClose: () => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function NodeContextMenu({ node, x, y, onEdit, onDelete, onStop, onStart, onClose }: NodeContextMenuProps) {
  const label = RESOURCE_LABELS[node.type] ?? node.type
  const showStopStart = node.type === 'ec2' || node.type === 'rds'

  const menu: React.CSSProperties = {
    position: 'fixed', left: x, top: y,
    background: '#0d1117', border: '1px solid #30363d', borderRadius: 4,
    padding: '4px 0', fontFamily: 'monospace', fontSize: 11, zIndex: 150, minWidth: 160,
  }
  const item: React.CSSProperties = {
    padding: '5px 14px', cursor: 'pointer', color: '#eee',
  }
  const itemRed: React.CSSProperties = { ...item, color: '#ff5f57' }

  const handleClick = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
    onClose()
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={onClose} />
      <div style={menu}>
        <div style={{ padding: '3px 14px 5px', color: '#555', fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #1e2d40', marginBottom: 2 }}>
          {node.id}
        </div>
        <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onEdit(node))}>
          ✎ Edit {label}
        </div>
        {showStopStart && node.status === 'running' && onStop && (
          <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onStop(node))}>
            ⏹ Stop {label}
          </div>
        )}
        {showStopStart && node.status === 'stopped' && onStart && (
          <div style={item} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onStart(node))}>
            ▶ Start {label}
          </div>
        )}
        <div style={{ borderTop: '1px solid #1e2d40', marginTop: 2 }} />
        <div style={itemRed} onMouseOver={e => (e.currentTarget.style.background = '#1a2332')} onMouseOut={e => (e.currentTarget.style.background = '')} onClick={handleClick(() => onDelete(node))}>
          ✕ Delete {label}
        </div>
      </div>
    </>
  )
}
