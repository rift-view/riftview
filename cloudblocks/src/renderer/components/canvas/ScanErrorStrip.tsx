import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function ScanErrorStrip(): React.JSX.Element | null {
  const scanErrors      = useCloudStore((s) => s.scanErrors)
  const setScanErrors   = useCloudStore((s) => s.setScanErrors)
  const clearScanErrors = useCloudStore((s) => s.clearScanErrors)
  const showToast       = useUIStore((s) => s.showToast)

  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  if (scanErrors.length === 0) return null

  async function handleRetry(service: string, region: string): Promise<void> {
    setRetrying((prev) => new Set(prev).add(service))
    try {
      const result = await window.cloudblocks.retryScanService(service)
      if (result.ok) {
        setScanErrors(scanErrors.filter((e) => !(e.service === service && e.region === region)))
      } else {
        showToast('Retry failed — check permissions', 'error')
      }
    } catch {
      showToast('Retry failed — check permissions', 'error')
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev)
        next.delete(service)
        return next
      })
    }
  }

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
            fontFamily:   'monospace',
            fontSize:     '10px',
            color:        '#f59e0b',
            lineHeight:   1.5,
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            display:      'flex',
            alignItems:   'center',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            [{err.service}] {err.region} — {err.message}
          </span>
          <button
            disabled={retrying.has(err.service)}
            onClick={() => { void handleRetry(err.service, err.region) }}
            style={{
              fontFamily:   'monospace',
              fontSize:     9,
              background:   'transparent',
              border:       '1px solid rgba(251,191,36,0.4)',
              color:        '#f59e0b',
              borderRadius: 3,
              padding:      '1px 6px',
              cursor:       retrying.has(err.service) ? 'default' : 'pointer',
              marginLeft:   8,
              flexShrink:   0,
            }}
          >
            {retrying.has(err.service) ? '...' : 'retry'}
          </button>
        </div>
      ))}
    </div>
  )
}
