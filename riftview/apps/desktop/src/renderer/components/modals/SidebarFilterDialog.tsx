import React from 'react'
import type { NodeType } from '@riftview/shared'

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

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
      style={{ zIndex: 200 }}
    >
      <div className="modal modal--sm">
        <div className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow">FILTER</span>
            <h2 className="modal-title">[{label}] only?</h2>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="form-helper">
            {count} node{count === 1 ? '' : 's'} will be highlighted
          </div>
        </div>
        <div className="modal-foot">
          <button onClick={onClose} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button autoFocus onClick={onConfirm} className="btn btn-sm btn-primary">
            Apply Filter
          </button>
        </div>
      </div>
    </div>
  )
}
