import { useUIStore } from '../store/ui'

export function KeyboardHelp(): React.JSX.Element | null {
  const open = useUIStore((s) => s.keyboardHelpOpen)
  const close = useUIStore((s) => s.setKeyboardHelpOpen)

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={() => close(false)}
    >
      <div
        style={{
          background: 'var(--ink-850)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '24px 32px',
          minWidth: 320,
          color: 'var(--fg)',
          fontFamily: 'monospace'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
            color: 'var(--bone-200)'
          }}
        >
          Keyboard Shortcuts
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <tbody>
            {[
              ['Navigation', ''],
              ['j / k', 'Next / previous node'],
              ['Enter', 'Fly to selected node'],
              ['/', 'Search nodes'],
              ['1 – 4', 'Load saved view'],
              ['', ''],
              ['Canvas', ''],
              ['Escape', 'Clear selection'],
              ['r', 'Re-scan AWS'],
              ['', ''],
              ['Other', ''],
              ['?', 'Toggle this help']
            ].map(([key, desc], i) =>
              !key && !desc ? (
                <tr key={i}>
                  <td colSpan={2} style={{ paddingTop: 8 }} />
                </tr>
              ) : !desc ? (
                <tr key={i}>
                  <td
                    colSpan={2}
                    style={{ color: 'var(--fg-muted)', fontSize: 11, paddingBottom: 4 }}
                  >
                    {key}
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td
                    style={{
                      paddingRight: 24,
                      paddingBottom: 4,
                      color: 'var(--accent)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {key}
                  </td>
                  <td style={{ color: 'var(--bone-200)', paddingBottom: 4 }}>{desc}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
