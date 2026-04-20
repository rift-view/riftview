import { Handle, Position, type NodeProps } from '@xyflow/react'

interface ApigwRouteNodeData {
  label: string
  method?: string
  path?: string
  hasLambda?: boolean
  dimmed?: boolean
  integrationLabel?: string
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function ApigwRouteNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as ApigwRouteNodeData

  // Parse method + path from label if not provided directly
  const label = d.label ?? ''
  const spaceIdx = label.indexOf(' ')
  const method = (d.method ?? (spaceIdx >= 0 ? label.slice(0, spaceIdx) : label)).toUpperCase()
  const path = d.path ?? (spaceIdx >= 0 ? label.slice(spaceIdx + 1) : '/')

  const integrationLabel = d.integrationLabel ?? (d.hasLambda ? 'λ lambda' : 'no integration')

  return (
    <div
      data-selected={selected}
      data-node-type="apigw-route"
      className={cx('rift-node', selected && 'rift-node--focused')}
      style={{
        boxSizing: 'border-box',
        minWidth: 140,
        padding: '8px 10px 9px',
        opacity: d.dimmed ? 0.25 : 1,
        filter: d.dimmed ? 'grayscale(60%)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <div className="rift-node-eye">API ROUTE</div>

      <div
        className="rift-node-title"
        title={`${method} ${path}`}
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <span className="route-method">{method}</span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0
          }}
        >
          {path}
        </span>
      </div>

      <hr className="rift-node-rule" />

      <div className="rift-node-meta">
        <span className="dot -neutral" aria-hidden="true" />
        <span
          title={integrationLabel}
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {integrationLabel}
        </span>
      </div>
    </div>
  )
}
