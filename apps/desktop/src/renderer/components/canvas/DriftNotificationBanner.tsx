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

  const topOffset = scanErrors.length > 0 ? 80 : 42

  return (
    <div
      data-testid="drift-banner"
      style={{
        position: 'absolute',
        top: `${topOffset}px`,
        left: 0,
        right: 0,
        zIndex: 9,
        background: 'oklch(0.73 0.17 50 / 0.08)',
        border: '1px solid oklch(0.73 0.17 50 / 0.30)',
        borderLeft: '2px solid var(--ember-500)',
        borderRight: 'none',
        padding: '4px 36px 4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <span className="eyebrow" style={{ color: 'var(--ember-500)' }}>
        DRIFT
      </span>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--bone-100)',
          flex: 1
        }}
      >
        {`${driftedCount} resource${driftedCount === 1 ? '' : 's'} drifted from Terraform state`}
      </span>

      <button
        onClick={(): void => useUIStore.getState().setDriftFilterActive(true)}
        title="View drifted resources"
        className="btn btn-sm btn-ghost"
      >
        View
      </button>

      <button
        onClick={dismissDriftBanner}
        title="Dismiss"
        className="btn-link"
        style={{
          position: 'absolute',
          top: 4,
          right: 8,
          fontSize: 12,
          padding: 0
        }}
      >
        ×
      </button>
    </div>
  )
}
