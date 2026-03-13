interface Props {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: Props){
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0"
      style={{ background: '#2a0a0a', border: '1px solid #ff5f57', borderLeft: '3px solid #ff5f57', fontFamily: 'monospace' }}
    >
      <span className="text-[9px]" style={{ color: '#ff5f57' }}>⚠ AWS Error:</span>
      <span className="text-[9px] flex-1" style={{ color: '#ffa0a0' }}>{message}</span>
      <button
        onClick={onDismiss}
        className="text-[9px] px-1"
        style={{ color: '#666', background: 'none', border: 'none', cursor: 'pointer' }}
      >✕</button>
    </div>
  )
}
