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

  if (!profile.name) {
    return (
      <div className="empty-state">
        <div className="empty-state-card">
          <span className="eyebrow">NO PROFILE CONNECTED</span>
          <h1 className="empty-state-title">Connect your AWS profile to get started</h1>
          <p className="empty-state-body">
            Add an AWS profile in Settings to begin scanning your infrastructure.
          </p>
          <button className="btn btn-primary" onClick={() => setShowSettings(true)}>
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  if (scanStatus === 'scanning') {
    return (
      <div className="empty-state" style={{ opacity: 0.6 }}>
        <span className="eyebrow">SCANNING INFRASTRUCTURE…</span>
        <ScanSkeleton />
      </div>
    )
  }

  if (hasScanned && scanStatus === 'idle') {
    return (
      <div className="empty-state">
        <div className="empty-state-card">
          <span className="eyebrow">REGION EMPTY</span>
          <h1 className="empty-state-title">No resources found in {region}</h1>
          <p className="empty-state-body">
            Check that your AWS profile has the required permissions and that resources exist in
            this region.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.riftview.startScan(selectedRegions)}
          >
            Scan Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <div className="empty-state-card">
        <span className="eyebrow">READY TO SCAN</span>
        <h1 className="empty-state-title">Scan your infrastructure to get started</h1>
        <p className="empty-state-body">
          No resources found in this account. Run a scan to discover your AWS infrastructure.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => window.riftview.startScan(selectedRegions)}
        >
          Start Scan
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => window.dispatchEvent(new CustomEvent('riftview:show-templates'))}
        >
          Browse Templates
        </button>
      </div>
    </div>
  )
}

function ScanSkeleton(): React.JSX.Element {
  const skeletonNode = (w: number, delay: string): React.JSX.Element => (
    <div
      style={{
        width: w,
        height: 66,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--ink-900)',
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
            'linear-gradient(90deg, transparent 0%, rgba(230,224,213,0.04) 50%, transparent 100%)',
          animation: `rift-shimmer var(--dur-slow, 1.8s) ease-in-out ${delay} infinite`
        }}
      />
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: 'var(--space-2xs)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)'
        }}
      >
        <div
          style={{
            width: 60,
            height: 8,
            borderRadius: 3,
            background: 'var(--border)',
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
      <div style={{ display: 'flex', gap: 10 }}>
        {skeletonNode(130, '0.3s')}
        {skeletonNode(130, '0.5s')}
        {skeletonNode(130, '0.7s')}
      </div>
    </div>
  )
}
