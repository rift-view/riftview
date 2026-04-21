import React from 'react'
import pkg from '../../../package.json'

const APP_VERSION = pkg.version

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps): React.JSX.Element {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      tabIndex={-1}
      style={{ zIndex: 300 }}
    >
      <div className="modal modal--sm">
        <div className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow">ABOUT</span>
            <h2 className="modal-title">RiftView</h2>
            <div className="form-helper" style={{ marginTop: 4 }}>
              Visual AWS infrastructure — scan, visualize, build.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="insp-rows">
            <div className="insp-row">
              <span className="k">VERSION</span>
              <span className="v">{APP_VERSION}</span>
            </div>
            <div className="insp-row">
              <span className="k">REPO</span>
              <span className="v">github.com/rift-view/riftview</span>
            </div>
          </div>
          <hr className="hairline" style={{ margin: '12px 0' }} />
          <p
            style={{
              fontSize: 11,
              color: 'var(--fg-muted)',
              lineHeight: 1.6,
              fontFamily: 'var(--font-body)'
            }}
          >
            Not affiliated with, endorsed by, or sponsored by Amazon Web Services. AWS and all
            related marks are trademarks of Amazon.com, Inc.
          </p>
        </div>
        <div className="modal-foot">
          <button autoFocus onClick={onClose} className="btn btn-sm btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
