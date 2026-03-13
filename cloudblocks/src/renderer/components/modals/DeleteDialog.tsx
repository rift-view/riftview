import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { DeleteOptions } from '../../utils/buildDeleteCommands'

interface DeleteDialogProps {
  node: CloudNode
  onClose: () => void
  onConfirm: (opts: DeleteOptions) => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC', ec2: 'EC2 Instance', 'security-group': 'Security Group',
  rds: 'RDS Instance', s3: 'S3 Bucket', lambda: 'Lambda Function', alb: 'Load Balancer',
}

export default function DeleteDialog({ node, onClose, onConfirm }: DeleteDialogProps) {
  const [input, setInput] = useState('')
  const [skipSnapshot, setSkipSnapshot] = useState(false)
  const [force, setForce] = useState(false)

  const confirmed = input === node.id

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  }
  const dialog: React.CSSProperties = {
    background: '#0d1117', border: '1px solid #ff5f57', borderRadius: 8,
    padding: 20, width: 340, fontFamily: 'monospace',
  }

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={dialog}>
        <div style={{ color: '#ff5f57', fontWeight: 'bold', fontSize: 13, marginBottom: 8 }}>
          Delete {RESOURCE_LABELS[node.type] ?? node.type}?
        </div>
        <div style={{ color: '#aaa', fontSize: 10, marginBottom: 4 }}>
          Type <span style={{ color: '#eee' }}>{node.id}</span> to confirm
        </div>
        <input
          autoFocus
          placeholder={node.id}
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{
            width: '100%', background: '#060d14', border: '1px solid #30363d',
            borderRadius: 3, padding: '4px 8px', color: '#eee',
            fontFamily: 'monospace', fontSize: 11, boxSizing: 'border-box', marginBottom: 10,
          }}
        />

        {node.type === 's3' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#aaa', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
            Force delete (removes all objects)
          </label>
        )}

        {node.type === 'rds' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#aaa', marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={skipSnapshot} onChange={e => setSkipSnapshot(e.target.checked)} />
            Skip final snapshot
          </label>
        )}

        <div style={{ color: '#555', fontSize: 9, marginBottom: 12 }}>This action cannot be undone.</div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: 3, padding: '4px 14px', color: '#aaa', fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            disabled={!confirmed}
            onClick={() => {
              const opts: DeleteOptions = {}
              if (skipSnapshot) opts.skipFinalSnapshot = true
              if (force) opts.force = true
              onConfirm(opts)
            }}
            style={{
              background: confirmed ? '#ff5f57' : '#3a1a1a',
              border: '1px solid #ff5f57', borderRadius: 3, padding: '4px 14px',
              color: confirmed ? '#000' : '#ff5f57', fontFamily: 'monospace', fontSize: 11,
              fontWeight: 'bold', cursor: confirmed ? 'pointer' : 'not-allowed', opacity: confirmed ? 1 : 0.5,
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
