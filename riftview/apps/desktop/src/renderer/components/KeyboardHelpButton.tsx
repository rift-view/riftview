import { useUIStore } from '../store/ui'

export function KeyboardHelpButton(): React.JSX.Element {
  const open = useUIStore((s) => s.keyboardHelpOpen)
  const setOpen = useUIStore((s) => s.setKeyboardHelpOpen)

  return (
    <button
      onClick={() => setOpen(!open)}
      title="Keyboard shortcuts (?)"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 900,
        width: 24,
        height: 24,
        borderRadius: 12,
        background: 'var(--ink-850)',
        border: '1px solid var(--border)',
        color: 'var(--fg-muted)',
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        padding: 0,
        opacity: 0.6,
        transition: 'opacity 0.15s ease, color 0.15s ease'
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.opacity = '1'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLButtonElement).style.opacity = '0.6'
        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-muted)'
      }}
    >
      ?
    </button>
  )
}
