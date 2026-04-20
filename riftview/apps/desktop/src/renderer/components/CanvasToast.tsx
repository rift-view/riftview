import { useUIStore } from '../store/ui'

export function CanvasToast(): React.JSX.Element | null {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null
  const variant = toast.type === 'error' ? 'rift-toast--error' : 'rift-toast--success'
  return (
    <div className={`rift-toast ${variant}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}
