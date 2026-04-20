import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function DriftModeStrip(): React.JSX.Element | null {
  const importedNodes = useCloudStore((s) => s.importedNodes)
  const nodes = useCloudStore((s) => s.nodes)
  const driftFilterActive = useUIStore((s) => s.driftFilterActive)
  const toggleDriftFilter = useUIStore((s) => s.toggleDriftFilter)

  if (importedNodes.length === 0) return null

  const driftMatched = nodes.filter((n) => n.driftStatus === 'matched').length
  const driftUnmanaged = nodes.filter((n) => n.driftStatus === 'unmanaged').length
  const driftMissing = importedNodes.filter((n) => n.driftStatus === 'missing').length

  async function handleClear(): Promise<void> {
    try {
      await window.riftview.clearTfState()
      useCloudStore.getState().clearImportedNodes()
    } catch {
      useUIStore.getState().showToast('Failed to clear Terraform import', 'error')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px',
        height: 28,
        flexShrink: 0,
        background: 'oklch(0.60 0.20 28 / 0.06)',
        borderBottom: '1px solid oklch(0.60 0.20 28 / 0.20)'
      }}
    >
      <span className="eyebrow" style={{ color: 'var(--fault-500)' }}>
        ⊘ DRIFT MODE
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--moss-500)'
        }}
      >
        ✓ {driftMatched} matched
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--ember-500)'
        }}
      >
        ! {driftUnmanaged} unmanaged
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fault-500)'
        }}
      >
        ✕ {driftMissing} missing
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          onClick={toggleDriftFilter}
          title={driftFilterActive ? 'Show all nodes' : 'Show only drifted nodes'}
          className={'btn btn-sm ' + (driftFilterActive ? 'btn-primary' : 'btn-ghost')}
        >
          ⊘ Drift only
        </button>
        <button
          onClick={() => {
            void handleClear()
          }}
          title="Clear imported Terraform state"
          className="btn btn-sm btn-ghost"
        >
          Clear TF ×
        </button>
      </div>
    </div>
  )
}
