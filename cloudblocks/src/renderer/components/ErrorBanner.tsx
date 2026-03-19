interface Props {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: Props): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0"
      style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderLeft: '3px solid #ff5f57', fontFamily: 'monospace' }}
    >
      <span className="text-[9px]" style={{ color: '#ff5f57' }}>⚠ AWS Error:</span>
      <span className="text-[9px] flex-1" style={{ color: 'var(--cb-text-primary)' }}>{message}</span>
      <button
        onClick={onDismiss}
        className="text-[9px] px-1"
        style={{ color: 'var(--cb-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
      >✕</button>
    </div>
  )
}
