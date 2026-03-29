import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function EmptyCanvasState(): React.JSX.Element | null {
  const profile        = useCloudStore((s) => s.profile)
  const nodes          = useCloudStore((s) => s.nodes)
  const scanStatus     = useCloudStore((s) => s.scanStatus)
  const selectedRegions = useCloudStore((s) => s.selectedRegions)
  const setShowSettings = useUIStore((s) => s.setShowSettings)

  if (nodes.length > 0) return null

  const overlayStyle: React.CSSProperties = {
    position:       'absolute',
    inset:          0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    pointerEvents:  'none',
    zIndex:         10,
  }

  const cardStyle: React.CSSProperties = {
    textAlign:   'center',
    fontFamily:  'monospace',
    pointerEvents: 'auto',
  }

  const headingStyle: React.CSSProperties = {
    fontSize:     15,
    color:        'var(--cb-text)',
    marginBottom: 8,
    fontWeight:   600,
  }

  const subStyle: React.CSSProperties = {
    fontSize:   13,
    color:      'var(--cb-text-secondary)',
    maxWidth:   320,
    lineHeight: 1.6,
    marginBottom: 16,
  }

  const btnStyle: React.CSSProperties = {
    fontFamily:   'monospace',
    fontSize:     12,
    padding:      '5px 16px',
    borderRadius: 4,
    cursor:       'pointer',
    background:   'var(--cb-bg-elevated)',
    border:       '1px solid var(--cb-accent)',
    color:        'var(--cb-accent)',
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
    return (
      <div style={overlayStyle}>
        <div style={{ ...cardStyle, pointerEvents: 'none' }}>
          <div style={headingStyle}>Scanning your infrastructure…</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cb-accent)', display: 'inline-block', animation: 'ecs-pulse 1.2s ease-in-out 0s infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cb-accent)', display: 'inline-block', animation: 'ecs-pulse 1.2s ease-in-out 0.4s infinite' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cb-accent)', display: 'inline-block', animation: 'ecs-pulse 1.2s ease-in-out 0.8s infinite' }} />
          </div>
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
        <button
          style={btnStyle}
          onClick={() => window.cloudblocks.startScan(selectedRegions)}
        >
          Start Scan
        </button>
        <button
          style={{ ...btnStyle, marginTop: 8, borderColor: 'var(--cb-border)', color: 'var(--cb-text-secondary)', fontSize: 11 }}
          onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-templates'))}
        >
          Browse Templates
        </button>
      </div>
    </div>
  )
}
