import { useUIStore } from '../store/ui'

const MODE_LABEL = {
  live: 'LIVE',
  timeline: 'TIMELINE',
  restore: 'RESTORE'
} as const

const MODE_COLOR = {
  live: 'var(--success, #34d399)',
  timeline: 'var(--accent, #f59e0b)',
  restore: 'var(--danger, #f87171)'
} as const

/**
 * RIFT-38: compact mode badge + "return to live" action. Always visible so
 * the operator can tell at a glance whether they're looking at live state
 * or a frozen snapshot.
 */
export function CanvasModeBadge(): React.JSX.Element {
  const canvasMode = useUIStore((s) => s.canvasMode)
  const setCanvasMode = useUIStore((s) => s.setCanvasMode)

  const label = MODE_LABEL[canvasMode]
  const color = MODE_COLOR[canvasMode]

  return (
    <div
      data-testid="canvas-mode-badge"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'monospace',
        fontSize: 11,
        letterSpacing: '0.08em'
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`
        }}
        aria-hidden
      />
      <span style={{ color }}>{label}</span>
      {canvasMode !== 'live' && (
        <button
          data-testid="canvas-mode-return-to-live"
          onClick={() => setCanvasMode('live')}
          style={{
            marginLeft: 4,
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            background: 'transparent',
            border: '1px solid var(--border, #334155)',
            borderRadius: 3,
            color: 'var(--fg-muted, #94a3b8)',
            cursor: 'pointer',
            letterSpacing: '0.06em'
          }}
          aria-label="return to live"
        >
          ← LIVE
        </button>
      )}
    </div>
  )
}
