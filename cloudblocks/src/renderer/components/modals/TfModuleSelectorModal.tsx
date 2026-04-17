import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { TfModuleInfo } from '../../types/tfstate'

interface Props {
  modules: TfModuleInfo[]
  onConfirm: (selectedNodes: CloudNode[]) => void
  onCancel: () => void
}

export default function TfModuleSelectorModal({
  modules,
  onConfirm,
  onCancel
}: Props): React.JSX.Element {
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(modules.map((m) => [m.name, true]))
  )

  const totalResources = modules.reduce((s, m) => s + m.resourceCount, 0)
  const selectedCount = modules
    .filter((m) => checked[m.name])
    .reduce((s, m) => s + m.resourceCount, 0)
  const noneSelected = selectedCount === 0

  function toggle(name: string): void {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function handleConfirm(): void {
    const selectedNodes = modules.filter((m) => checked[m.name]).flatMap((m) => m.nodes)
    onConfirm(selectedNodes)
  }

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200
  }
  const dialog: React.CSSProperties = {
    background: 'var(--cb-bg-panel)',
    border: '1px solid var(--cb-border-strong)',
    borderRadius: 8,
    padding: 20,
    width: 400,
    fontFamily: 'monospace',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column'
  }

  // Single-module fast path — just show counts + confirm
  const isSingleModule = modules.length === 1

  return (
    <div
      style={overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      tabIndex={-1}
    >
      <div style={dialog}>
        {/* Header */}
        <div
          style={{ color: 'var(--cb-accent)', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}
        >
          Import Terraform State
        </div>
        <div style={{ color: 'var(--cb-text-muted)', fontSize: 10, marginBottom: 16 }}>
          Found {modules.length} module{modules.length !== 1 ? 's' : ''} · {totalResources} total
          resource{totalResources !== 1 ? 's' : ''}
        </div>

        {/* Module list — hidden when only 1 module */}
        {!isSingleModule && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: 16,
              border: '1px solid var(--cb-border)',
              borderRadius: 4
            }}
          >
            {modules.map((m, idx) => (
              <label
                key={m.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  borderBottom: idx < modules.length - 1 ? '1px solid var(--cb-border)' : 'none',
                  background: checked[m.name] ? 'rgba(99,102,241,0.06)' : 'transparent'
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[m.name] ?? false}
                  onChange={() => toggle(m.name)}
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, color: 'var(--cb-text-primary)', fontSize: 11 }}>
                  {m.name}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    color: 'var(--cb-text-muted)',
                    background: 'var(--cb-bg-elevated)',
                    borderRadius: 3,
                    padding: '1px 5px',
                    flexShrink: 0
                  }}
                >
                  {m.resourceCount} resource{m.resourceCount !== 1 ? 's' : ''}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Selection summary */}
        <div style={{ color: 'var(--cb-text-muted)', fontSize: 9, marginBottom: 14 }}>
          {isSingleModule
            ? `${totalResources} resource${totalResources !== 1 ? 's' : ''} will be imported`
            : `${selectedCount} of ${totalResources} resource${totalResources !== 1 ? 's' : ''} selected`}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'var(--cb-bg-elevated)',
              border: '1px solid var(--cb-border)',
              borderRadius: 3,
              padding: '4px 14px',
              color: 'var(--cb-text-secondary)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={noneSelected}
            style={{
              background: noneSelected ? 'var(--cb-bg-elevated)' : 'var(--cb-accent)',
              border: '1px solid var(--cb-accent)',
              borderRadius: 3,
              padding: '4px 14px',
              color: noneSelected ? 'var(--cb-accent)' : 'var(--cb-bg-panel)',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: noneSelected ? 'not-allowed' : 'pointer',
              opacity: noneSelected ? 0.5 : 1
            }}
          >
            {isSingleModule ? `Import ${totalResources}` : `Import Selected (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
