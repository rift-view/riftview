import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function DriftModeStrip(): React.JSX.Element | null {
  const importedNodes     = useCloudStore((s) => s.importedNodes)
  const nodes             = useCloudStore((s) => s.nodes)
  const driftFilterActive = useUIStore((s) => s.driftFilterActive)
  const toggleDriftFilter = useUIStore((s) => s.toggleDriftFilter)

  if (importedNodes.length === 0) return null

  const driftMatched   = nodes.filter((n) => n.driftStatus === 'matched').length
  const driftUnmanaged = nodes.filter((n) => n.driftStatus === 'unmanaged').length
  const driftMissing   = importedNodes.filter((n) => n.driftStatus === 'missing').length

  async function handleClear(): Promise<void> {
    try {
      await window.cloudblocks.clearTfState()
      useCloudStore.getState().clearImportedNodes()
    } catch {
      useUIStore.getState().showToast('Failed to clear Terraform import', 'error')
    }
  }

  const btn: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 9, borderRadius: 3,
    padding: '1px 8px', cursor: 'pointer', background: 'transparent',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 12px', height: 28, flexShrink: 0,
      background: 'rgba(239,68,68,0.06)',
      borderBottom: '1px solid rgba(239,68,68,0.2)',
      fontFamily: 'monospace',
    }}>
      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 'bold', letterSpacing: '0.05em' }}>
        ⊘ DRIFT MODE
      </span>
      <span style={{ fontSize: 10, color: '#22c55e' }}>✓ {driftMatched} matched</span>
      <span style={{ fontSize: 10, color: '#f59e0b' }}>! {driftUnmanaged} unmanaged</span>
      <span style={{ fontSize: 10, color: '#ef4444' }}>✕ {driftMissing} missing</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          onClick={toggleDriftFilter}
          title={driftFilterActive ? 'Show all nodes' : 'Show only drifted nodes'}
          style={{ ...btn, border: `1px solid ${driftFilterActive ? '#ef4444' : 'var(--cb-border)'}`, color: driftFilterActive ? '#ef4444' : 'var(--cb-text-muted)' }}
        >
          ⊘ Drift only
        </button>
        <button
          onClick={() => { void handleClear() }}
          title="Clear imported Terraform state"
          style={{ ...btn, border: '1px solid var(--cb-border)', color: '#f59e0b' }}
        >
          Clear TF ×
        </button>
      </div>
    </div>
  )
}
