import React, { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { DeleteOptions } from '../../utils/buildDeleteCommands'

interface DeleteDialogProps {
  node: CloudNode
  onClose: () => void
  onConfirm: (opts: DeleteOptions) => void
}

const RESOURCE_LABELS: Record<string, string> = {
  vpc: 'VPC',
  ec2: 'EC2 Instance',
  'security-group': 'Security Group',
  rds: 'RDS Instance',
  s3: 'S3 Bucket',
  lambda: 'Lambda Function',
  alb: 'Load Balancer'
}

export default function DeleteDialog({
  node,
  onClose,
  onConfirm
}: DeleteDialogProps): React.JSX.Element {
  const [input, setInput] = useState('')
  const [skipSnapshot, setSkipSnapshot] = useState(false)
  const [force, setForce] = useState(false)
  const [disableProtection, setDisableProtection] = useState(false)

  const confirmed = input === node.id

  return (
    <div
      className="modal-backdrop"
      data-testid="delete-dialog"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
      style={{ zIndex: 200 }}
    >
      <div className="modal modal--sm" style={{ borderLeft: '2px solid var(--fault-500)' }}>
        <div className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow" style={{ color: 'var(--fault-500)' }}>
              DELETE
            </span>
            <h2 className="modal-title">{RESOURCE_LABELS[node.type] ?? node.type}?</h2>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label className="label">
              Type <span style={{ color: 'var(--bone-50)' }}>{node.id}</span> to confirm
            </label>
            <input
              autoFocus
              data-testid="delete-dialog-confirm-input"
              placeholder={node.id}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="form-input"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          {node.type === 's3' && (
            <label className="form-checkbox" style={{ marginBottom: 8 }}>
              <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
              Force delete (removes all objects)
            </label>
          )}

          {node.type === 'rds' && (
            <label className="form-checkbox" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={skipSnapshot}
                onChange={(e) => setSkipSnapshot(e.target.checked)}
              />
              Skip final snapshot
            </label>
          )}

          {node.type === 'rds' && node.metadata?.deletionProtection === true && (
            <label className="form-checkbox" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={disableProtection}
                onChange={(e) => setDisableProtection(e.target.checked)}
              />
              Disable deletion protection first
            </label>
          )}

          <div className="form-helper" style={{ color: 'var(--fault-500)' }}>
            This action cannot be undone.
          </div>
        </div>

        <div className="modal-foot">
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button
            disabled={!confirmed}
            data-testid="delete-dialog-confirm"
            onClick={() => {
              const opts: DeleteOptions = {}
              if (skipSnapshot) opts.skipFinalSnapshot = true
              if (force) opts.force = true
              if (disableProtection) opts.disableProtectionFirst = true
              onConfirm(opts)
            }}
            className="btn btn-sm"
            style={{
              background: confirmed ? 'var(--fault-500)' : 'transparent',
              borderColor: 'var(--fault-500)',
              color: confirmed ? 'var(--ink-1000)' : 'var(--fault-500)',
              cursor: confirmed ? 'pointer' : 'not-allowed',
              opacity: confirmed ? 1 : 0.5
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
