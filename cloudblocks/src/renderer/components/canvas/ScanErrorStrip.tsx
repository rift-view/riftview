import { useCloudStore } from '../../store/cloud'

export function ScanErrorStrip(): React.JSX.Element | null {
  const scanErrors     = useCloudStore((s) => s.scanErrors)
  const clearScanErrors = useCloudStore((s) => s.clearScanErrors)

  if (scanErrors.length === 0) return null

  return (
    <div
      style={{
        position:        'absolute',
        top:             '42px',
        left:            0,
        right:           0,
        zIndex:          9,
        background:      'rgba(251, 191, 36, 0.1)',
        border:          '1px solid rgba(251, 191, 36, 0.35)',
        borderLeft:      'none',
        borderRight:     'none',
        padding:         '4px 36px 4px 10px',
        maxHeight:       '120px',
        overflowY:       'auto',
      }}
    >
      {/* Dismiss button */}
      <button
        onClick={clearScanErrors}
        title="Dismiss"
        style={{
          position:    'absolute',
          top:         '4px',
          right:       '8px',
          background:  'transparent',
          border:      'none',
          cursor:      'pointer',
          color:       '#f59e0b',
          fontFamily:  'monospace',
          fontSize:    '11px',
          lineHeight:  1,
          padding:     '0 2px',
        }}
      >
        ✕ Dismiss
      </button>

      {/* Error rows */}
      {scanErrors.map((err, i) => (
        <div
          key={i}
          style={{
            fontFamily:  'monospace',
            fontSize:    '10px',
            color:       '#f59e0b',
            lineHeight:  1.5,
            whiteSpace:  'nowrap',
            overflow:    'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          [{err.service}] {err.region} — {err.message}
        </div>
      ))}
    </div>
  )
}
