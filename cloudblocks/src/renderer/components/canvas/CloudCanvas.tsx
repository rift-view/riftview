import { useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCloudStore } from '../../store/cloud'
import { TopologyView } from './TopologyView'
import { GraphView } from './GraphView'
import { CanvasContextMenu } from './CanvasContextMenu'
import type { CloudNode } from '../../types/cloud'

interface Props {
  onScan: () => void
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

/** Inner component — must live inside ReactFlowProvider to access useReactFlow hooks. */
function CanvasInner({ onScan, onNodeContextMenu }: Props): JSX.Element {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const view       = useCloudStore((s) => s.view)
  const setView    = useCloudStore((s) => s.setView)
  const scanStatus = useCloudStore((s) => s.scanStatus)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const btnBase = { fontFamily: 'monospace', fontSize: '9px', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div className="relative flex-1 h-full" onContextMenu={handleContextMenu}>
      {/* Toolbar */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md"
           style={{ background: '#0d1320', border: '1px solid #1e2d40' }}>
        <button
          onClick={onScan}
          disabled={scanStatus === 'scanning'}
          style={{ ...btnBase, background: '#1a2332', border: '1px solid #FF9900', color: '#FF9900', opacity: scanStatus === 'scanning' ? 0.5 : 1 }}
        >
          {scanStatus === 'scanning' ? '⟳ Scanning…' : '⟳ Scan'}
        </button>

        <div className="w-px h-3.5 bg-gray-700" />

        <button onClick={() => fitView({ duration: 300 })} style={{ ...btnBase, background: '#111', border: '1px solid #333', color: '#aaa' }}>
          ⊞ Fit
        </button>
        <button onClick={() => zoomIn()}  style={{ ...btnBase, background: '#111', border: '1px solid #333', color: '#aaa' }}>+</button>
        <button onClick={() => zoomOut()} style={{ ...btnBase, background: '#111', border: '1px solid #333', color: '#aaa' }}>−</button>

        <div className="w-px h-3.5 bg-gray-700" />

        {(['topology', 'graph'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              ...btnBase,
              background: view === v ? '#1a2332' : 'transparent',
              border: `1px solid ${view === v ? '#64b5f6' : '#333'}`,
              color: view === v ? '#64b5f6' : '#666',
            }}
          >
            {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
          </button>
        ))}
      </div>

      {view === 'topology'
        ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
        : <GraphView onNodeContextMenu={onNodeContextMenu} />
      }

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export function CloudCanvas(props: Props): JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
