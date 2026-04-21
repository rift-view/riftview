import type { NodeProps } from '@xyflow/react'

interface ApigwNodeData {
  label: string
  endpoint?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  dimmed?: boolean
  routeCount?: number
  metadata?: Record<string, unknown>
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function ApigwNode({ data, selected }: NodeProps): React.JSX.Element {
  const d = data as unknown as ApigwNodeData
  const m = d.metadata ?? {}
  const endpointType = d.endpoint ?? (m.endpointType as string | undefined) ?? 'HTTP'
  const routeCount =
    typeof d.routeCount === 'number'
      ? d.routeCount
      : typeof m.routeCount === 'number'
        ? (m.routeCount as number)
        : undefined

  const metaParts: string[] = [endpointType]
  if (routeCount !== undefined) {
    metaParts.push(`${routeCount} route${routeCount === 1 ? '' : 's'}`)
  }

  return (
    <div
      data-selected={selected}
      data-node-type="apigw"
      className={cx('rift-node', selected && 'rift-node--focused')}
      style={{
        // width/height: 100% fills the React Flow wrapper in TopologyView
        // (wrapper gets explicit style.width/height from buildFlowNodes).
        // In GraphView the wrapper auto-sizes, so minWidth/minHeight take over.
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        minWidth: Math.max(280, d.label.length * 8 + 120),
        minHeight: 80,
        padding: '10px 12px',
        overflow: 'hidden',
        opacity: d.dimmed ? 0.25 : 1,
        filter: d.dimmed ? 'grayscale(60%)' : 'none',
        transition: 'opacity 0.2s, filter 0.2s'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rift-node-eye">API GATEWAY</div>
          <div
            className="rift-node-title"
            title={d.label}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {d.label}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            d.onToggleCollapse?.()
          }}
          title={d.collapsed ? 'Expand routes' : 'Collapse routes'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '0 2px',
            lineHeight: 1,
            flexShrink: 0
          }}
        >
          {d.collapsed ? '▸' : '▾'}
        </button>
      </div>

      <hr className="rift-node-rule" />

      <div className="rift-node-meta">
        <span className="dot -neutral" aria-hidden="true" />
        <span>{metaParts.join(' · ')}</span>
      </div>
    </div>
  )
}
