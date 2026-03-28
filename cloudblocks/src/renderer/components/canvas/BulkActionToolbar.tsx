import React from 'react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import { resolveDeleteCommands } from '../../plugin/pluginCommands'

export function BulkActionToolbar(): React.JSX.Element | null {
  const selectedNodeIds    = useUIStore((s) => s.selectedNodeIds)
  const clearSelectedNodeIds = useUIStore((s) => s.clearSelectedNodeIds)
  const nodes              = useCloudStore((s) => s.nodes)
  const importedNodes      = useCloudStore((s) => s.importedNodes)

  if (selectedNodeIds.size <= 1) return null

  const allNodes = [...nodes, ...importedNodes]
  const selectedNodes = allNodes.filter((n) => selectedNodeIds.has(n.id))

  async function handleBulkDelete(): Promise<void> {
    const commands = selectedNodes.flatMap((n) => resolveDeleteCommands(n))
    if (commands.length === 0) {
      useUIStore.getState().showToast('No delete commands available for selected nodes', 'error')
      return
    }
    clearSelectedNodeIds()
    await window.cloudblocks.runCli(commands)
  }

  async function handleBulkExport(): Promise<void> {
    const res = await window.cloudblocks.exportTerraform(selectedNodes)
    if (res.success) {
      if (res.skippedTypes && res.skippedTypes.length > 0) {
        useUIStore.getState().showToast(
          `Exported. Skipped unsupported types: ${res.skippedTypes.join(', ')}`,
          'error',
        )
      } else {
        useUIStore.getState().showToast('HCL exported', 'success')
      }
    } else {
      useUIStore.getState().showToast('Export failed', 'error')
    }
  }

  const btnBase: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '9px',
    borderRadius: '4px',
    padding: '3px 10px',
    cursor: 'pointer',
    border: 'none',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '44px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '6px',
        background: 'var(--cb-bg-elevated)',
        border: '1px solid var(--cb-accent)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        pointerEvents: 'all',
      }}
    >
      <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--cb-accent)' }}>
        {selectedNodeIds.size} selected
      </span>
      <div style={{ width: 1, height: 12, background: 'var(--cb-border-strong)' }} />
      <button
        onClick={() => { void handleBulkDelete() }}
        style={{ ...btnBase, background: 'rgba(239,68,68,0.15)', color: '#ff5f57', border: '1px solid #ff5f57' }}
      >
        ✕ Delete {selectedNodeIds.size} nodes
      </button>
      <button
        onClick={() => { void handleBulkExport() }}
        style={{ ...btnBase, background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid #a78bfa' }}
      >
        ⬡ Export HCL
      </button>
      <button
        onClick={clearSelectedNodeIds}
        style={{ ...btnBase, background: 'transparent', color: 'var(--cb-text-muted)', border: '1px solid var(--cb-border)', padding: '3px 6px' }}
        title="Clear selection"
      >
        ✕
      </button>
    </div>
  )
}
