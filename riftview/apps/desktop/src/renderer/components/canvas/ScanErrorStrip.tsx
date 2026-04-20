import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function ScanErrorStrip(): React.JSX.Element | null {
  const scanErrors = useCloudStore((s) => s.scanErrors)
  const setScanErrors = useCloudStore((s) => s.setScanErrors)
  const clearScanErrors = useCloudStore((s) => s.clearScanErrors)
  const showToast = useUIStore((s) => s.showToast)

  const [retrying, setRetrying] = useState<Set<string>>(new Set())

  if (scanErrors.length === 0) return null

  async function handleRetry(service: string, region: string): Promise<void> {
    setRetrying((prev) => new Set(prev).add(service))
    try {
      const result = await window.riftview.retryScanService(service)
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
        position: 'absolute',
        top: '42px',
        left: 0,
        right: 0,
        zIndex: 9,
        background: 'oklch(0.73 0.17 50 / 0.08)',
        border: '1px solid oklch(0.73 0.17 50 / 0.30)',
        borderLeft: '2px solid var(--ember-500)',
        borderRight: 'none',
        padding: '6px 36px 6px 10px',
        maxHeight: '120px',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4
        }}
      >
        <span className="eyebrow" style={{ color: 'var(--ember-500)' }}>
          SCAN ERRORS
        </span>
        <button
          onClick={clearScanErrors}
          title="Dismiss"
          className="btn-link"
          style={{
            position: 'absolute',
            top: 6,
            right: 10,
            fontSize: 10,
            color: 'var(--ember-500)'
          }}
        >
          Dismiss ×
        </button>
      </div>

      {scanErrors.map((err, i) => (
        <div
          key={i}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--bone-200)',
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--ember-500)',
              marginRight: 4
            }}
          >
            [{err.service}]
          </span>
          <span
            style={{
              color: 'var(--fg-muted)',
              marginRight: 6
            }}
          >
            {err.region}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {err.message}
          </span>
          <button
            disabled={retrying.has(err.service)}
            onClick={() => {
              void handleRetry(err.service, err.region)
            }}
            className="btn btn-sm btn-ghost"
            style={{ marginLeft: 8, flexShrink: 0, fontSize: 9, padding: '0 6px' }}
          >
            {retrying.has(err.service) ? '…' : 'retry'}
          </button>
        </div>
      ))}
    </div>
  )
}
