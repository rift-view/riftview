import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus } from '../../../types/cloud'

const BORDER_COLOR = '#a78bfa'   // CloudFront: violet / edge purple

function statusStripeColor(status: NodeStatus): string {
  switch (status) {
    case 'running':  return 'var(--cb-success, #22c55e)'
    case 'stopped':  return 'var(--cb-text-muted, #6b7280)'
    case 'pending':
    case 'creating': return 'var(--cb-warning, #f59e0b)'
    case 'error':
    case 'deleting': return 'var(--cb-error, #ef4444)'
    case 'unknown':
    default:         return 'var(--cb-border, #374151)'
  }
}

interface CloudFrontNodeData {
  label:   string
  status:  NodeStatus
  dimmed?: boolean
}

export function CloudFrontNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as CloudFrontNodeData
  const stripeColor = statusStripeColor(d.status)

  return (
    <div
      data-selected={selected}
      className={`relative rounded${d.status === 'creating' ? ' animate-pulse' : ''}`}
      style={{
        background:  'var(--cb-bg-panel)',
        border:      `${selected ? '2px' : '1px'} solid ${BORDER_COLOR}`,
        borderLeft:  `3px solid ${stripeColor}`,
        boxShadow:   selected ? `0 0 10px ${BORDER_COLOR}55` : 'none',
        fontFamily:  'monospace',
        minWidth:    130,
        padding:     '6px 10px 6px 8px',
        opacity:     d.dimmed ? 0.25 : 1,
        filter:      d.dimmed ? 'grayscale(60%)' : 'none',
        transition:  'opacity 0.2s, filter 0.2s',
      }}
    >
      <Handle type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  style={{ opacity: 0 }} />

      <div className="mb-1">
        <span
          className="text-[9px] font-bold tracking-wider"
          style={{ color: BORDER_COLOR, opacity: 0.85 }}
        >
          CF
        </span>
      </div>

      <div
        className="text-[11px] font-medium leading-tight"
        style={{ color: 'var(--cb-text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {d.label}
      </div>
    </div>
  )
}
