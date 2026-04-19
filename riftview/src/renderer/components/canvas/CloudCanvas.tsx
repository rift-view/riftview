import { useState, useEffect, useCallback, useRef } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { StickyNote } from '../../store/ui'
import { TopologyView } from './TopologyView'
import { GraphView } from './GraphView'
import { CommandView } from './CommandView'
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
  const view = useUIStore((s) => s.view)
  const effectiveView = (view === 'command' ? 'topology' : view) as 'topology' | 'graph'
  const setView = useUIStore((s) => s.setView)
  const showCommandTab = true
  const profile = useCloudStore((s) => s.profile)
  const savedViews = useUIStore((s) => s.savedViews)
  const activeViewSlot = useUIStore((s) => s.activeViewSlot)
  const saveView = useUIStore((s) => s.saveView)
  const loadView = useUIStore((s) => s.loadView)
  const showIntegrations = useUIStore((s) => s.showIntegrations)
  const toggleIntegrations = useUIStore((s) => s.toggleIntegrations)
  const snapToGrid = useUIStore((s) => s.snapToGrid)
  const toggleSnapToGrid = useUIStore((s) => s.toggleSnapToGrid)
  const addStickyNote = useUIStore((s) => s.addStickyNote)
  const setAnnotation = useUIStore((s) => s.setAnnotation)

  const [modalSlot, setModalSlot] = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Ghost hint overlay — shown once after the first successful scan with nodes
  const nodes = useCloudStore((s) => s.nodes)
  const lastScannedAt = useCloudStore((s) => s.lastScannedAt)
  const [hintVisible, setHintVisible] = useState(false)
  const [hintOpacity, setHintOpacity] = useState(1)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!lastScannedAt || nodes.length === 0) return
    if (localStorage.getItem('riftview-hint-seen')) return
    // Show the hint (mark seen immediately so it never re-shows)
    localStorage.setItem('riftview-hint-seen', '1')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHintOpacity(1)
    setHintVisible(true)
    // Fade out after 4 seconds
    hintTimerRef.current = setTimeout(() => {
      setHintOpacity(0)
      setTimeout(() => setHintVisible(false), 500)
    }, 4000)
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [lastScannedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint(): void {
    if (!hintVisible) return
    localStorage.setItem('riftview-hint-seen', '1')
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHintOpacity(0)
    setTimeout(() => setHintVisible(false), 500)
  }

  // CRT turn-on animation key — remounts the overlay on profile switch to replay the animation.
  const profileKey = profile.name + '|' + (profile.endpoint ?? '')

  // Listen for search-palette node selection — fly camera to the selected node
  useEffect(() => {
    function onFitNode(e: Event): void {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 })
    }
    window.addEventListener('riftview:fitnode', onFitNode)
    return () => window.removeEventListener('riftview:fitnode', onFitNode)
  }, [fitView])

  // Listen for tidy layout — fit the whole view after positions are applied
  useEffect(() => {
    const handler = (): void => {
      void fitView({ duration: 300 })
    }
    window.addEventListener('riftview:fitview', handler)
    return () => window.removeEventListener('riftview:fitview', handler)
  }, [fitView])

  // Listen for canvas export requests from TitleBar
  const handleExport = useCallback(
    (e: Event) => {
      const format = (e as CustomEvent<{ format: 'clipboard' | 'file' }>).detail?.format ?? 'file'
      void exportCanvasToPng(fitView, format)
    },
    [fitView]
  )
  useEffect(() => {
    window.addEventListener('riftview:export-canvas', handleExport)
    return () => window.removeEventListener('riftview:export-canvas', handleExport)
  }, [handleExport])

  // Listen for "Add Note" shortcut / button
  useEffect(() => {
    function onAddStickyNote(): void {
      const id = `sn-${Date.now()}`
      const note: StickyNote = { id, content: '', position: { x: 120, y: 120 } }
      addStickyNote(note)
      setAnnotation(`sticky:${id}`, '')
      void window.riftview.saveAnnotations({
        ...useUIStore.getState().annotations,
        [`sticky:${id}`]: ''
      })
    }
    window.addEventListener('riftview:add-sticky-note', onAddStickyNote)
    return () => window.removeEventListener('riftview:add-sticky-note', onAddStickyNote)
  }, [addStickyNote, setAnnotation])

  const btnBase = {
    fontFamily: 'monospace',
    fontSize: '9px',
    borderRadius: '4px',
    padding: '2px 8px',
    cursor: 'pointer'
  }

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
      loadView(slot, effectiveView, () => fitView({ duration: 300 }))
    }
  }

  function handleModalSave(name: string): void {
    if (modalSlot === null) return
    saveView(modalSlot, name, effectiveView)
    setModalSlot(null)
  }

  const activeViewName = activeViewSlot !== null ? (savedViews[activeViewSlot]?.name ?? null) : null

  return (
    <div className="flex flex-col flex-1 h-full">
      <DriftModeStrip />

      <div className="relative flex-1" onContextMenu={handleContextMenu}>
        {/* Viewport toolbar */}
        <div
          className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{
            background: 'var(--cb-minimap-bg)',
            border: '1px solid var(--cb-border-strong)'
          }}
        >
          <button
            onClick={() => fitView({ duration: 300 })}
            style={{
              ...btnBase,
              background: 'var(--cb-bg-elevated)',
              border: '1px solid var(--cb-border)',
              color: 'var(--cb-text-secondary)'
            }}
          >
            ⊞ Fit
          </button>
          <button
            onClick={() => zoomIn()}
            style={{
              ...btnBase,
              background: 'var(--cb-bg-elevated)',
              border: '1px solid var(--cb-border)',
              color: 'var(--cb-text-secondary)'
            }}
          >
            +
          </button>
          <button
            onClick={() => zoomOut()}
            style={{
              ...btnBase,
              background: 'var(--cb-bg-elevated)',
              border: '1px solid var(--cb-border)',
              color: 'var(--cb-text-secondary)'
            }}
          >
            −
          </button>

          <div className="w-px h-3.5 bg-gray-700" />

          <button
            onClick={toggleIntegrations}
            title={showIntegrations ? 'Hide integration edges' : 'Show integration edges'}
            style={{
              ...btnBase,
              background: showIntegrations ? 'var(--cb-bg-elevated)' : 'transparent',
              border: `1px solid ${showIntegrations ? '#64b5f6' : 'var(--cb-border)'}`,
              color: showIntegrations ? '#64b5f6' : '#666'
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
              color: snapToGrid ? '#64b5f6' : '#666'
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
                color: view === v ? '#64b5f6' : '#666'
              }}
            >
              {v === 'topology' ? '⊞ Map' : '◈ Free'}
            </button>
          ))}

          {showCommandTab && (
            <button
              onClick={() => setView('command')}
              style={{
                ...btnBase,
                background: view === 'command' ? 'var(--cb-bg-elevated)' : 'transparent',
                border: `1px solid ${view === 'command' ? '#a78bfa' : 'var(--cb-border)'}`,
                color: view === 'command' ? '#a78bfa' : '#666'
              }}
            >
              ⌘ Command
            </button>
          )}

          <div className="w-px h-3.5 bg-gray-700" />

          {([0, 1, 2, 3] as const).map((slot) => {
            const saved = savedViews[slot]
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
                  color: saved
                    ? isActive
                      ? 'var(--cb-accent)'
                      : 'var(--cb-text-secondary)'
                    : '#444',
                  minWidth: '20px'
                }}
              >
                {slot + 1}
              </button>
            )
          })}

          {activeViewName && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--cb-text-muted)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {activeViewName}
            </span>
          )}
        </div>

        <ScanErrorStrip />
        <BulkActionToolbar />

        {view === 'topology' ? (
          <TopologyView onNodeContextMenu={onNodeContextMenu} />
        ) : view === 'command' ? (
          <CommandView onNodeContextMenu={onNodeContextMenu} />
        ) : (
          <GraphView onNodeContextMenu={onNodeContextMenu} />
        )}

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
              whiteSpace: 'nowrap'
            }}
          >
            LOCAL · {profile.endpoint}
          </div>
        )}

        <EmptyCanvasState />

        {/* Ghost hint overlay — one-time discoverability hint after first scan */}
        {hintVisible && (
          <div
            onClick={dismissHint}
            style={{
              position: 'absolute',
              bottom: 48,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '10px 16px 10px 16px',
              color: '#94a3b8',
              fontSize: 12,
              textAlign: 'center',
              pointerEvents: 'auto',
              cursor: 'pointer',
              zIndex: 20,
              opacity: hintOpacity,
              transition: 'opacity 0.5s',
              whiteSpace: 'nowrap',
              fontFamily: 'monospace'
            }}
            title="Click to dismiss"
          >
            <div style={{ color: '#e2e8f0', marginBottom: 4, fontWeight: 600 }}>
              Found {nodes.length} resource{nodes.length === 1 ? '' : 's'}
            </div>
            <div>
              <span style={{ color: '#f59e0b' }}>⬤</span>
              {' Click any node to see its blast radius'}
            </div>
            <div>
              <span style={{ color: '#60a5fa' }}>⇧</span>
              {' Shift + click to trace a path'}
            </div>
          </div>
        )}

        {/* CRT turn-on animation overlay — remounts on profile change to replay the animation */}
        <div
          key={profileKey}
          style={{
            position: 'absolute',
            inset: 0,
            background: '#000',
            pointerEvents: 'none',
            zIndex: 200,
            animation: 'crt-on 0.7s ease-out forwards'
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
