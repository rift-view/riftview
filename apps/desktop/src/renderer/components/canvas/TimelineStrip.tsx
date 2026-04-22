import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { CanvasMode } from '../../store/ui'

interface VersionMeta {
  id: string
  timestamp: string
  profile: string
  region: string
  endpoint: string | null
  contentHash: string
  scanMeta: {
    nodeCount: number
    edgeCount: number
    scanErrors: string[]
    pluginId: string
    pluginVersion: string
    schemaVersion: number
  }
}

const DOT_SIZE = 8
const DOT_GAP = 6
const MAX_DOTS = 40

interface TimelineStripViewProps {
  versions: VersionMeta[]
  canvasMode: CanvasMode
  activeSnapshotId: string | null
  loading: boolean
  onSelect: (snapshotId: string) => void
  onExit: () => void
  /**
   * Region label rendered in the strip header. The wrapper derives this from
   * the cloud store; stories supply a literal. Optional so Ladle fixtures can
   * omit it without losing the dot list.
   */
  region?: string
}

/**
 * RIFT-19: presentation layer for the timeline strip. Pure — no store reads,
 * no IPC. The wrapper (see below) handles data loading and wires callbacks.
 *
 * Returns null when there are no versions AND the canvas is in live mode,
 * matching the wrapper's original empty-state behavior. In timeline/restore
 * mode with an empty list the strip still renders (loading/activity affordance).
 */
// onExit is part of the RIFT-19 contract so consumers can wire an exit
// affordance later. Current DOM is frozen (Canvas blocked pixel drift), so
// the view does not render a button yet — the prop is reserved so the future
// exit control does not force another signature change.
export function TimelineStripView(props: TimelineStripViewProps): React.JSX.Element | null {
  const { versions, canvasMode, activeSnapshotId, loading, onSelect, region } = props
  void props.onExit
  // Oldest → newest left-to-right. Store returns newest-first; reverse for the strip.
  const orderedVersions = useMemo(() => [...versions].reverse(), [versions])

  if (versions.length === 0 && canvasMode === 'live' && !loading) return null

  return (
    <div
      data-testid="timeline-strip"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        background: 'linear-gradient(to top, rgba(15,23,42,0.95), rgba(15,23,42,0.0))',
        display: 'flex',
        alignItems: 'center',
        gap: DOT_GAP,
        padding: '0 14px',
        pointerEvents: 'auto',
        zIndex: 10,
        fontFamily: 'monospace',
        fontSize: 10,
        color: 'var(--fg-muted, #94a3b8)'
      }}
    >
      <span style={{ opacity: 0.7, letterSpacing: '0.08em' }}>
        TIMELINE{region ? ` · ${region}` : ''}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DOT_GAP,
          overflowX: 'auto',
          flex: 1
        }}
      >
        {orderedVersions.map((v) => {
          const isActive = canvasMode !== 'live' && v.id === activeSnapshotId
          return (
            <button
              key={v.id}
              data-testid={`timeline-dot-${v.id}`}
              onClick={() => onSelect(v.id)}
              title={`${v.timestamp.replace('T', ' ').slice(0, 19)} · ${v.scanMeta.nodeCount} nodes · ${v.contentHash.slice(0, 7)}`}
              style={{
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                border: `1px solid ${isActive ? 'var(--accent, #f59e0b)' : 'var(--border, #334155)'}`,
                background: isActive ? 'var(--accent, #f59e0b)' : 'transparent',
                padding: 0,
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
                flexShrink: 0
              }}
              aria-label={`snapshot ${v.id} at ${v.timestamp}`}
            />
          )
        })}
      </div>
      {loading && <span style={{ opacity: 0.5 }}>…</span>}
    </div>
  )
}

/**
 * RIFT-38: minimum visible UI for the snapshot store. Renders a horizontal
 * strip of dots at the bottom of the canvas — one dot per stored snapshot
 * for the current profile + region. Clicking a dot loads that snapshot
 * into timeline mode; the canvas then renders from the snapshot's node
 * set instead of the live scan.
 *
 * Read-only — no restore affordance, no diff. Restore lives in RIFT-19/21
 * and is gated by the RIFT-20 threat model.
 *
 * RIFT-19: data + store wiring lives here; the DOM is in TimelineStripView
 * above so Ladle can render the strip without booting the renderer shell.
 */
export function TimelineStrip(): React.JSX.Element | null {
  const profile = useCloudStore((s) => s.profile)
  const selectedRegions = useCloudStore((s) => s.selectedRegions)
  const canvasMode = useUIStore((s) => s.canvasMode)
  const activeSnapshotId = useUIStore((s) => s.activeSnapshotId)
  const setCanvasMode = useUIStore((s) => s.setCanvasMode)
  const setActiveSnapshot = useUIStore((s) => s.setActiveSnapshot)
  const showToast = useUIStore((s) => s.showToast)

  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [loading, setLoading] = useState(false)

  // Effective region — timeline strip shows versions for exactly one region
  // at a time. When the user has multiple selected, pick the first stable
  // value so the dot list is predictable.
  const region = selectedRegions[0] ?? ''

  useEffect(() => {
    if (!profile.name || !region) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    window.riftview
      .listSnapshots({ profile: profile.name, region, limit: MAX_DOTS })
      .then((rows) => {
        if (!cancelled) setVersions(rows as unknown as VersionMeta[])
      })
      .catch((err: Error) => {
        if (!cancelled) {
          console.error('[timeline] listSnapshots failed', err)
          setVersions([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile.name, region])

  const handleSelect = useCallback(
    async (versionId: string) => {
      try {
        const snap = await window.riftview.readSnapshot(versionId)
        if (!snap) {
          showToast('snapshot not found', 'error')
          return
        }
        setActiveSnapshot({
          meta: {
            id: snap.meta.id,
            timestamp: snap.meta.timestamp,
            profile: snap.meta.profile,
            region: snap.meta.region,
            endpoint: snap.meta.endpoint,
            contentHash: snap.meta.contentHash
          },
          nodes: snap.nodes
        })
        setCanvasMode('timeline', versionId)
      } catch (err) {
        console.error('[timeline] readSnapshot failed', err)
        showToast('failed to load snapshot', 'error')
      }
    },
    [setActiveSnapshot, setCanvasMode, showToast]
  )

  const handleExit = useCallback(() => {
    setCanvasMode('live', null)
    setActiveSnapshot(null)
  }, [setCanvasMode, setActiveSnapshot])

  if (!profile.name || !region) return null

  return (
    <TimelineStripView
      versions={versions}
      canvasMode={canvasMode}
      activeSnapshotId={activeSnapshotId}
      loading={loading}
      onSelect={handleSelect}
      onExit={handleExit}
      region={region}
    />
  )
}
