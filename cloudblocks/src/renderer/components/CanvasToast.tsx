import { useUIStore } from '../store/ui'

export function CanvasToast(): React.JSX.Element | null {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null
  return (
    <div
      style={{
        position:  'absolute',
        bottom:    52,
        left:      '50%',
        transform: 'translateX(-50%)',
        zIndex:    1000,
        background: toast.type === 'error'
          ? 'var(--cb-status-error)'
          : 'var(--cb-status-running)',
        color:        'var(--cb-bg)',
        padding:      '5px 14px',
        borderRadius: 4,
        fontSize:     11,
        fontFamily:   'monospace',
        pointerEvents: 'none',
        whiteSpace:   'nowrap',
      }}
    >
      {toast.message}
    </div>
  )
}
