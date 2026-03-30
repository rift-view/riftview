import { useState, useEffect } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { StickyNote } from '../../store/ui'
import { TopologyView } from './TopologyView'
import { GraphView } from './GraphView'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasToast } from '../CanvasToast'
import { SaveViewModal } from './SaveViewModal'
import { ScanErrorStrip } from './ScanErrorStrip'
import { DriftNotificationBanner } from './DriftNotificationBanner'
import { EmptyCanvasState } from './EmptyCanvasState'
import { BulkActionToolbar } from './BulkActionToolbar'
import type { CloudNode } from '../../types/cloud'
import { getMonthlyEstimate, formatPrice } from '../../utils/pricing'

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
  const importedNodes      = useCloudStore((s) => s.importedNodes)
  const profile            = useCloudStore((s) => s.profile)
  const savedViews         = useUIStore((s) => s.savedViews)
  const activeViewSlot     = useUIStore((s) => s.activeViewSlot)
  const saveView           = useUIStore((s) => s.saveView)
  const loadView           = useUIStore((s) => s.loadView)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const toggleIntegrations = useUIStore((s) => s.toggleIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const toggleSnapToGrid   = useUIStore((s) => s.toggleSnapToGrid)
  const driftFilterActive  = useUIStore((s) => s.driftFilterActive)
  const toggleDriftFilter  = useUIStore((s) => s.toggleDriftFilter)
  const addStickyNote  = useUIStore((s) => s.addStickyNote)
  const setAnnotation  = useUIStore((s) => s.setAnnotation)

  const [modalSlot, setModalSlot] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [, forceUpdate] = useState(0)

  const totalCost = nodes.reduce((sum, n) => {
    const est = getMonthlyEstimate(n.type, n.region ?? 'us-east-1')
    return sum + (est ?? 0)
  }, 0)

  // Refresh the relative timestamp every 10 seconds
  useEffect(() => {
    if (!lastScannedAt) return
    const id = setInterval(() => forceUpdate(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [lastScannedAt])

  // CRT turn-on animation key — remounts the overlay on profile switch to replay the animation.
  const profileKey = profile.name + '|' + (profile.endpoint ?? '')

  // Listen for search-palette node selection — fly camera to the selected node
  useEffect(() => {
    function onFitNode(e: Event): void {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 })
    }
    window.addEventListener('cloudblocks:fitnode', onFitNode)
    return () => window.removeEventListener('cloudblocks:fitnode', onFitNode)
  }, [fitView])

  // Listen for tidy layout — fit the whole view after positions are applied
  useEffect(() => {
    const handler = (): void => { void fitView({ duration: 300 }) }
    window.addEventListener('cloudblocks:fitview', handler)
    return () => window.removeEventListener('cloudblocks:fitview', handler)
  }, [fitView])

  // Listen for "Add Note" shortcut / button
  useEffect(() => {
    function onAddStickyNote(): void {
      const id   = `sn-${Date.now()}`
      const note: StickyNote = { id, content: '', position: { x: 120, y: 120 } }
      addStickyNote(note)
      // persist an empty entry so the note survives reload until it gets content
      const next = { ...useUIStore.getState().annotations, [`sticky:${id}`]: '' }
      setAnnotation(`sticky:${id}`, '')
      void window.cloudblocks.saveAnnotations(next)
    }
    window.addEventListener('cloudblocks:add-sticky-note', onAddStickyNote)
    return () => window.removeEventListener('cloudblocks:add-sticky-note', onAddStickyNote)
  }, [addStickyNote, setAnnotation])

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

  async function handleClearImport(): Promise<void> {
    try {
      await window.cloudblocks.clearTfState()
      useCloudStore.getState().clearImportedNodes()
    } catch {
      useUIStore.getState().showToast('Failed to clear Terraform import', 'error')
    }
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

        {nodes.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--cb-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {formatPrice(totalCost)}
          </span>
        )}

        <div className="w-px h-3.5 bg-gray-700" />

        <button
          onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:add-sticky-note'))}
          title="Add sticky note (⌘⇧N)"
          style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid #ca8a04', color: '#ca8a04' }}
        >
          ✎ Note
        </button>

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

        {importedNodes.length > 0 && (
          <button
            onClick={toggleDriftFilter}
            title={driftFilterActive ? 'Show all nodes' : 'Show only unmanaged and missing nodes'}
            style={{
              ...btnBase,
              background: driftFilterActive ? 'var(--cb-bg-elevated)' : 'transparent',
              border: `1px solid ${driftFilterActive ? '#ef4444' : 'var(--cb-border)'}`,
              color:  driftFilterActive ? '#ef4444' : '#666',
            }}
          >
            ⊘ Drift only
          </button>
        )}

        {importedNodes.length > 0 && (
          <button
            onClick={() => { void handleClearImport() }}
            title="Clear imported Terraform nodes"
            style={{
              ...btnBase,
              background: 'var(--cb-bg-elevated)',
              border: '1px solid #f59e0b',
              color: '#f59e0b',
            }}
          >
            Clear TF ({importedNodes.length})
          </button>
        )}

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

      <ScanErrorStrip />
      <DriftNotificationBanner />
      <BulkActionToolbar />

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

      <EmptyCanvasState />

      {/* CRT turn-on animation overlay — remounts on profile change to replay the animation */}
      <div
        key={profileKey}
        style={{
          position:        'absolute',
          inset:           0,
          background:      '#000',
          pointerEvents:   'none',
          zIndex:          200,
          animation:       'crt-on 0.7s ease-out forwards',
        }}
      />

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
