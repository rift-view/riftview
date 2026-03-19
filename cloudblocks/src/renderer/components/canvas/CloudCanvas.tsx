import { useState, useEffect } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { TopologyView } from './TopologyView'
import { GraphView } from './GraphView'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasToast } from '../CanvasToast'
import { SaveViewModal } from './SaveViewModal'
import type { CloudNode } from '../../types/cloud'

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

interface Props {
  onScan: () => void
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

/** Inner component — must live inside ReactFlowProvider to access useReactFlow hooks. */
function CanvasInner({ onScan, onNodeContextMenu }: Props): React.JSX.Element {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const view               = useUIStore((s) => s.view)
  const setView            = useUIStore((s) => s.setView)
  const scanStatus         = useCloudStore((s) => s.scanStatus)
  const lastScannedAt      = useCloudStore((s) => s.lastScannedAt)
  const nodes              = useCloudStore((s) => s.nodes)
  const profile            = useCloudStore((s) => s.profile)
  const savedViews         = useUIStore((s) => s.savedViews)
  const activeViewSlot     = useUIStore((s) => s.activeViewSlot)
  const saveView           = useUIStore((s) => s.saveView)
  const loadView           = useUIStore((s) => s.loadView)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const toggleIntegrations = useUIStore((s) => s.toggleIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const toggleSnapToGrid   = useUIStore((s) => s.toggleSnapToGrid)
  const [modalSlot, setModalSlot] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [, forceUpdate] = useState(0)

  // Refresh the relative timestamp every 10 seconds
  useEffect(() => {
    if (!lastScannedAt) return
    const id = setInterval(() => forceUpdate(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [lastScannedAt])

  // Listen for search-palette node selection — fly camera to the selected node
  useEffect(() => {
    function onFitNode(e: Event): void {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 })
    }
    window.addEventListener('cloudblocks:fitnode', onFitNode)
    return () => window.removeEventListener('cloudblocks:fitnode', onFitNode)
  }, [fitView])

  const btnBase = { fontFamily: 'monospace', fontSize: '9px', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleSlotClick(slot: number): void {
    const saved = savedViews[slot]
    if (saved === null) {
      setModalSlot(slot)                                       // empty → open modal to create
    } else if (slot === activeViewSlot) {
      setModalSlot(slot)                                       // active → open modal to rename
    } else {
      loadView(slot, view, () => fitView({ duration: 300 }))  // saved non-active → load
    }
  }

  function handleModalSave(name: string): void {
    if (modalSlot === null) return
    saveView(modalSlot, name, view)
    setModalSlot(null)
  }

  const activeViewName = activeViewSlot !== null
    ? (savedViews[activeViewSlot]?.name ?? null)
    : null

  return (
    <div className="relative flex-1 h-full" onContextMenu={handleContextMenu}>
      {/* Toolbar */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md"
           style={{ background: 'var(--cb-minimap-bg)', border: '1px solid var(--cb-border-strong)' }}>
        <button
          onClick={onScan}
          disabled={scanStatus === 'scanning'}
          style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)', opacity: scanStatus === 'scanning' ? 0.5 : 1 }}
        >
          {scanStatus === 'scanning' ? '⟳ Scanning…' : '⟳ Scan'}
        </button>

        {lastScannedAt && (
          <span style={{ fontSize: 11, color: 'var(--cb-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            Scanned {relativeTime(lastScannedAt)}
          </span>
        )}

        <div className="w-px h-3.5 bg-gray-700" />

        <button onClick={() => fitView({ duration: 300 })} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>
          ⊞ Fit
        </button>
        <button onClick={() => zoomIn()}  style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>+</button>
        <button onClick={() => zoomOut()} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>−</button>

        <div className="w-px h-3.5 bg-gray-700" />

        <button
          onClick={toggleIntegrations}
          title={showIntegrations ? 'Hide integration edges' : 'Show integration edges'}
          style={{
            ...btnBase,
            background: showIntegrations ? 'var(--cb-bg-elevated)' : 'transparent',
            border: `1px solid ${showIntegrations ? '#64b5f6' : 'var(--cb-border)'}`,
            color:  showIntegrations ? '#64b5f6' : '#666',
          }}
        >
          ⇢ Integrations
        </button>

        <button
          onClick={toggleSnapToGrid}
          title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
          style={{
            ...btnBase,
            background: snapToGrid ? 'var(--cb-bg-elevated)' : 'transparent',
            border: `1px solid ${snapToGrid ? '#64b5f6' : 'var(--cb-border)'}`,
            color:  snapToGrid ? '#64b5f6' : '#666',
          }}
        >
          ▦ Grid
        </button>

        <div className="w-px h-3.5 bg-gray-700" />

        {(['topology', 'graph'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              ...btnBase,
              background: view === v ? 'var(--cb-bg-elevated)' : 'transparent',
              border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`,
              color: view === v ? '#64b5f6' : '#666',
            }}
          >
            {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
          </button>
        ))}

        <div className="w-px h-3.5 bg-gray-700" />

        {/* Saved view slots */}
        {([0, 1, 2, 3] as const).map((slot) => {
          const saved    = savedViews[slot]
          const isActive = slot === activeViewSlot
          return (
            <button
              key={slot}
              onClick={() => handleSlotClick(slot)}
              title={saved?.name ?? `Empty slot ${slot + 1}`}
              style={{
                ...btnBase,
                background: isActive ? 'var(--cb-bg-elevated)' : 'transparent',
                border: `1px solid ${saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-border-strong)') : 'var(--cb-border)'}`,
                color:  saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-text-secondary)') : '#444',
                minWidth: '20px',
              }}
            >
              {slot + 1}
            </button>
          )
        })}

        {activeViewName && (
          <span style={{ fontSize: 10, color: 'var(--cb-text-muted)', fontFamily: 'monospace',
                         whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeViewName}
          </span>
        )}
      </div>

      {view === 'topology'
        ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
        : <GraphView onNodeContextMenu={onNodeContextMenu} />
      }

      {/* Local endpoint badge */}
      {profile.endpoint && (
        <div
          style={{
            position: 'absolute',
            top: '52px',
            left: '8px',
            zIndex: 10,
            background: 'rgba(251, 191, 36, 0.15)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#f59e0b',
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
          }}
        >
          LOCAL · {profile.endpoint}
        </div>
      )}

      {/* Empty state overlay — shown when scan completed (idle) and no nodes exist */}
      {nodes.length === 0 && scanStatus === 'idle' && (
        <div
          style={{
            position:        'absolute',
            inset:           0,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            pointerEvents:   'none',
            zIndex:          5,
          }}
        >
          <div
            style={{
              textAlign:   'center',
              color:       'var(--cb-text-muted)',
              fontFamily:  'monospace',
            }}
          >
            <div style={{ fontSize: 15, color: 'var(--cb-text)', marginBottom: 8, fontWeight: 600 }}>
              No resources found
            </div>
            <div style={{ fontSize: 13, color: 'var(--cb-text-muted)', maxWidth: 320, lineHeight: 1.6 }}>
              Create your first resource from the sidebar, or drag one onto the canvas to get started.
            </div>
            {profile.endpoint && (
              <div style={{ fontSize: 12, color: 'var(--cb-text-muted)', maxWidth: 320, marginTop: 10, lineHeight: 1.6, opacity: 0.75 }}>
                Start your local AWS emulator and trigger a scan.
              </div>
            )}
          </div>
        </div>
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      <CanvasToast />

      {modalSlot !== null && (
        <SaveViewModal
          slot={modalSlot}
          initialName={savedViews[modalSlot]?.name ?? ''}
          onSave={handleModalSave}
          onCancel={() => setModalSlot(null)}
        />
      )}
    </div>
  )
}

export function CloudCanvas(props: Props): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
