import type { NodeProps } from '@xyflow/react'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GlobalZoneNode(_props: NodeProps): React.JSX.Element {
  return (
    <div
      className="rift-zone"
      style={{
        minWidth: 200,
        minHeight: 80,
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}
    >
      <span className="rift-container-label">Global · Edge</span>
    </div>
  )
}
