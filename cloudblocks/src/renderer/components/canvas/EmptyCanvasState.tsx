import { useState, useEffect, useRef } from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function EmptyCanvasState(): React.JSX.Element | null {
  const profile = useCloudStore((s) => s.profile)
  const nodes = useCloudStore((s) => s.nodes)
  const scanStatus = useCloudStore((s) => s.scanStatus)
  const region = useCloudStore((s) => s.region)
  const selectedRegions = useCloudStore((s) => s.selectedRegions)
  const setShowSettings = useUIStore((s) => s.setShowSettings)

  const [hasScanned, setHasScanned] = useState(false)
  const prevStatusRef = useRef(scanStatus)

  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = scanStatus
    if (scanStatus === 'scanning') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasScanned(false)
    } else if (prev === 'scanning' && scanStatus === 'idle') {
      setHasScanned(true)
    }
  }, [scanStatus])

  if (nodes.length > 0) return null

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 10
  }

  const cardStyle: React.CSSProperties = {
    textAlign: 'center',
    fontFamily: 'monospace',
    pointerEvents: 'auto'
  }

  const headingStyle: React.CSSProperties = {
    fontSize: 15,
    color: 'var(--cb-text)',
    marginBottom: 8,
    fontWeight: 600
  }

  const subStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--cb-text-secondary)',
    maxWidth: 320,
    lineHeight: 1.6,
    marginBottom: 16
  }

  const btnStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: '5px 16px',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'var(--cb-bg-elevated)',
    border: '1px solid var(--cb-accent)',
    color: 'var(--cb-accent)'
  }

  if (!profile.name) {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={headingStyle}>Connect your AWS profile to get started</div>
          <div style={subStyle}>
            Add an AWS profile in Settings to begin scanning your infrastructure.
          </div>
          <button style={btnStyle} onClick={() => setShowSettings(true)}>
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  if (scanStatus === 'scanning') {
    const skeletonNode = (w = 150, delay = '0s'): React.JSX.Element => (
      <div
        style={{
          width: w,
          height: 66,
          borderRadius: 6,
          border: '1px solid var(--cb-border)',
          background: 'var(--cb-bg-panel)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
            animation: `cb-shimmer 1.8s ease-in-out ${delay} infinite`
          }}
        />
      </div>
    )
    return (
      <div style={{ ...overlayStyle, flexDirection: 'column', gap: 32, opacity: 0.6 }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'var(--cb-text-muted)',
            letterSpacing: '0.08em'
          }}
        >
          SCANNING INFRASTRUCTURE…
        </div>
        {/* Row 1 — suggests a VPC with resources */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            border: '1px dashed var(--cb-border)',
            borderRadius: 8
          }}
        >
          <div
            style={{
              width: 60,
              height: 8,
              borderRadius: 3,
              background: 'var(--cb-border)',
              marginBottom: 4
            }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            {skeletonNode(150, '0s')}
            {skeletonNode(150, '0.2s')}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {skeletonNode(150, '0.4s')}
            {skeletonNode(150, '0.6s')}
          </div>
        </div>
        {/* Row 2 — global zone strip */}
        <div style={{ display: 'flex', gap: 10 }}>
          {skeletonNode(130, '0.3s')}
          {skeletonNode(130, '0.5s')}
          {skeletonNode(130, '0.7s')}
        </div>
      </div>
    )
  }

  if (hasScanned && scanStatus === 'idle') {
    return (
      <div style={overlayStyle}>
        <div style={cardStyle}>
          <div style={headingStyle}>No resources found in {region}</div>
          <div style={subStyle}>
            Check that your AWS profile has the required permissions and that resources exist in
            this region.
          </div>
          <button style={btnStyle} onClick={() => window.terminus.startScan(selectedRegions)}>
            Scan Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={headingStyle}>Scan your infrastructure to get started</div>
        <div style={subStyle}>
          No resources found in this account. Run a scan to discover your AWS infrastructure.
        </div>
        <button style={btnStyle} onClick={() => window.terminus.startScan(selectedRegions)}>
          Start Scan
        </button>
        <button
          style={{
            ...btnStyle,
            marginTop: 8,
            borderColor: 'var(--cb-border)',
            color: 'var(--cb-text-secondary)',
            fontSize: 11
          }}
          onClick={() => window.dispatchEvent(new CustomEvent('terminus:show-templates'))}
        >
          Browse Templates
        </button>
      </div>
    </div>
  )
}
