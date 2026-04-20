import React from 'react'
import pkg from '../../../package.json'

const APP_VERSION = pkg.version

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps): React.JSX.Element {
  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300
  }

  const dialog: React.CSSProperties = {
    background: 'var(--ink-900)',
    border: '1px solid var(--border-strong)',
    borderRadius: 8,
    padding: '28px 32px',
    width: 380,
    fontFamily: 'monospace',
    display: 'flex',
    flexDirection: 'column',
    gap: 0
  }

  return (
    <div
      style={overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
    >
      <div style={dialog}>
        {/* App name */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
            marginBottom: 6
          }}
        >
          RiftView
        </div>

        {/* Tagline */}
        <div style={{ fontSize: 12, color: 'var(--bone-200)', marginBottom: 4 }}>
          Visual AWS infrastructure — scan, visualize, build.
        </div>

        {/* Version */}
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginBottom: 16 }}>
          v{APP_VERSION}
        </div>

        {/* GitHub */}
        <div style={{ fontSize: 11, color: 'var(--bone-200)', marginBottom: 18 }}>
          github.com/juliushamm/riftview
        </div>

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 14 }} />

        {/* Disclaimer */}
        <div
          style={{ fontSize: 9, color: 'var(--fg-muted)', lineHeight: 1.6, marginBottom: 22 }}
        >
          Not affiliated with, endorsed by, or sponsored by Amazon Web Services. AWS and all related
          marks are trademarks of Amazon.com, Inc.
        </div>

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            autoFocus
            onClick={onClose}
            style={{
              background: 'var(--ink-850)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 18px',
              color: 'var(--bone-200)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
