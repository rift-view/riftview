import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function DriftNotificationBanner(): React.JSX.Element | null {
  const importedNodes = useCloudStore((s) => s.importedNodes)
  const settings = useCloudStore((s) => s.settings)
  const scanErrors = useCloudStore((s) => s.scanErrors)
  const driftBannerDismissed = useUIStore((s) => s.driftBannerDismissed)
  const dismissDriftBanner = useUIStore((s) => s.dismissDriftBanner)

  if (!settings.notifyOnDrift) return null
  if (importedNodes.length === 0) return null

  const driftedCount = importedNodes.filter(
    (n) => n.driftStatus === 'unmanaged' || n.driftStatus === 'missing'
  ).length

  if (driftedCount === 0) return null
  if (driftBannerDismissed) return null

  // Offset below ScanErrorStrip if it is also visible
  const topOffset = scanErrors.length > 0 ? 80 : 42

  return (
    <div
      style={{
        position: 'absolute',
        top: `${topOffset}px`,
        left: 0,
        right: 0,
        zIndex: 9,
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.35)',
        borderLeft: 'none',
        borderRight: 'none',
        padding: '4px 36px 4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#f59e0b',
          lineHeight: 1.5,
          flex: 1
        }}
      >
        {`⚠ ${driftedCount} resource${driftedCount === 1 ? '' : 's'} drifted from Terraform state`}
      </span>

      <button
        onClick={(): void => useUIStore.getState().setDriftFilterActive(true)}
        title="View drifted resources"
        style={{
          background: 'transparent',
          border: '1px solid rgba(251, 191, 36, 0.5)',
          cursor: 'pointer',
          color: '#f59e0b',
          fontFamily: 'monospace',
          fontSize: '10px',
          lineHeight: 1,
          padding: '2px 8px',
          borderRadius: 3
        }}
      >
        View
      </button>

      {/* Dismiss button */}
      <button
        onClick={dismissDriftBanner}
        title="Dismiss"
        style={{
          position: 'absolute',
          top: '4px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#f59e0b',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: 1,
          padding: '0 2px'
        }}
      >
        ✕
      </button>
    </div>
  )
}
