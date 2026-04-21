import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { NodeStatus } from '@riftview/shared'

interface AcmNodeData {
  label: string
  status: NodeStatus
  dimmed?: boolean
  metadata?: Record<string, unknown>
}

function statusDotClass(status: NodeStatus): string {
  switch (status) {
    case 'running':
      return '-ok'
    case 'pending':
    case 'creating':
      return '-pending'
    case 'error':
    case 'deleting':
      return '-err'
    case 'stopped':
    case 'unknown':
      return '-neutral'
    case 'imported':
      return '-warn'
    default:
      return '-neutral'
  }
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function AcmNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as AcmNodeData
  const m = d.metadata ?? {}
  const validationStatus =
    (m.status as string | undefined) ?? (m.validationStatus as string | undefined) ?? d.status

  return (
    <div
      data-selected={selected}
      data-status={d.status}
      data-node-type="acm"
      className={cx(
        'rift-node',
        selected && 'rift-node--focused',
        (d.status === 'pending' || d.status === 'creating') && 'rift-node--pending',
        d.status === 'error' && 'rift-node--error'
      )}
      style={{
        opacity: d.dimmed ? 0.25 : undefined,
        filter: d.dimmed ? 'grayscale(60%)' : undefined,
        transition: 'opacity 0.2s, filter 0.2s'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div className="rift-node-eye">ACM CERTIFICATE</div>

      <div
        className="rift-node-title"
        title={d.label}
        style={{
          maxWidth: 180,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {d.label}
      </div>

      <hr className="rift-node-rule" />

      <div className="rift-node-meta">
        <span className={cx('dot', statusDotClass(d.status))} aria-hidden="true" />
        <span>{validationStatus}</span>
      </div>
    </div>
  )
}
