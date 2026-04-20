interface Props {
  message: string
  onDismiss: () => void
}

export function ErrorBanner({ message, onDismiss }: Props): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-3 px-3 py-2 flex-shrink-0"
      style={{
        background: 'var(--bg-elev-1)',
        border: '1px solid var(--border)',
        borderLeft: '2px solid var(--fault-500)'
      }}
    >
      <span className="eyebrow" style={{ color: 'var(--fault-500)' }}>
        ERROR
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--bone-100)',
          flex: 1
        }}
      >
        {message}
      </span>
      <button onClick={onDismiss} className="btn-link" style={{ fontSize: 12 }} title="Dismiss">
        ×
      </button>
    </div>
  )
}
