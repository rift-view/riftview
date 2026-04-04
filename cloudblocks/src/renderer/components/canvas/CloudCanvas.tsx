import { useState, useEffect, useCallback } from 'react'
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
import { DriftModeStrip } from './DriftModeStrip'
import { EmptyCanvasState } from './EmptyCanvasState'
import { BulkActionToolbar } from './BulkActionToolbar'
import type { CloudNode } from '../../types/cloud'
import { exportCanvasToPng } from '../../utils/exportCanvas'

interface Props {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

/** Inner component — must live inside ReactFlowProvider to access useReactFlow hooks. */
function CanvasInner({ onNodeContextMenu }: Props): React.JSX.Element {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const view           = useUIStore((s) => s.view)
  const setView        = useUIStore((s) => s.setView)
  const profile        = useCloudStore((s) => s.profile)
  const savedViews     = useUIStore((s) => s.savedViews)
  const activeViewSlot = useUIStore((s) => s.activeViewSlot)
  const saveView       = useUIStore((s) => s.saveView)
  const loadView       = useUIStore((s) => s.loadView)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const toggleIntegrations = useUIStore((s) => s.toggleIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const toggleSnapToGrid   = useUIStore((s) => s.toggleSnapToGrid)
  const addStickyNote  = useUIStore((s) => s.addStickyNote)
  const setAnnotation  = useUIStore((s) => s.setAnnotation)

  const [modalSlot, setModalSlot]     = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

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

  // Listen for canvas export requests from TitleBar
  const handleExport = useCallback((e: Event) => {
    const format = (e as CustomEvent<{ format: 'clipboard' | 'file' }>).detail?.format ?? 'file'
    void exportCanvasToPng(fitView, format)
  }, [fitView])
  useEffect(() => {
    window.addEventListener('cloudblocks:export-canvas', handleExport)
    return () => window.removeEventListener('cloudblocks:export-canvas', handleExport)
  }, [handleExport])

  // Listen for "Add Note" shortcut / button
  useEffect(() => {
    function onAddStickyNote(): void {
      const id   = `sn-${Date.now()}`
      const note: StickyNote = { id, content: '', position: { x: 120, y: 120 } }
      addStickyNote(note)
      setAnnotation(`sticky:${id}`, '')
      void window.cloudblocks.saveAnnotations({ ...useUIStore.getState().annotations, [`sticky:${id}`]: '' })
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
      setModalSlot(slot)
    } else if (slot === activeViewSlot) {
      setModalSlot(slot)
    } else {
      loadView(slot, view, () => fitView({ duration: 300 }))
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
    <div className="flex flex-col flex-1 h-full">
      <DriftModeStrip />

      <div className="relative flex-1" onContextMenu={handleContextMenu}>
        {/* Viewport toolbar */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md"
             style={{ background: 'var(--cb-minimap-bg)', border: '1px solid var(--cb-border-strong)' }}>

          <button onClick={() => fitView({ duration: 300 })} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>⊞ Fit</button>
          <button onClick={() => zoomIn()}  style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>+</button>
          <button onClick={() => zoomOut()} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>−</button>

          <div className="w-px h-3.5 bg-gray-700" />

          <button
            onClick={toggleIntegrations}
            title={showIntegrations ? 'Hide integration edges' : 'Show integration edges'}
            style={{ ...btnBase, background: showIntegrations ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${showIntegrations ? '#64b5f6' : 'var(--cb-border)'}`, color: showIntegrations ? '#64b5f6' : '#666' }}
          >⇢ Integrations</button>

          <button
            onClick={toggleSnapToGrid}
            title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
            style={{ ...btnBase, background: snapToGrid ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${snapToGrid ? '#64b5f6' : 'var(--cb-border)'}`, color: snapToGrid ? '#64b5f6' : '#666' }}
          >▦ Grid</button>

          <div className="w-px h-3.5 bg-gray-700" />

          {(['topology', 'graph'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{ ...btnBase, background: view === v ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`, color: view === v ? '#64b5f6' : '#666' }}
            >
              {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
            </button>
          ))}

          <div className="w-px h-3.5 bg-gray-700" />

          {([0, 1, 2, 3] as const).map((slot) => {
            const saved    = savedViews[slot]
            const isActive = slot === activeViewSlot
            return (
              <button
                key={slot}
                onClick={() => handleSlotClick(slot)}
                title={saved?.name ?? `Empty slot ${slot + 1}`}
                style={{ ...btnBase, background: isActive ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-border-strong)') : 'var(--cb-border)'}`, color: saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-text-secondary)') : '#444', minWidth: '20px' }}
              >
                {slot + 1}
              </button>
            )
          })}

          {activeViewName && (
            <span style={{ fontSize: 10, color: 'var(--cb-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeViewName}
            </span>
          )}
        </div>

        <ScanErrorStrip />
        <BulkActionToolbar />

        {view === 'topology'
          ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
          : <GraphView onNodeContextMenu={onNodeContextMenu} />
        }

        {/* Local endpoint badge */}
        {profile.endpoint && (
          <div
            style={{
              position: 'absolute', top: '52px', left: '8px', zIndex: 10,
              background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)',
              color: '#f59e0b', fontSize: '11px', padding: '2px 8px',
              borderRadius: '4px', fontFamily: 'monospace', whiteSpace: 'nowrap',
            }}
          >
            LOCAL · {profile.endpoint}
          </div>
        )}

        <EmptyCanvasState />

        {/* CRT turn-on animation overlay — remounts on profile change to replay the animation */}
        <div
          key={profileKey}
          style={{ position: 'absolute', inset: 0, background: '#000', pointerEvents: 'none', zIndex: 200, animation: 'crt-on 0.7s ease-out forwards' }}
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
