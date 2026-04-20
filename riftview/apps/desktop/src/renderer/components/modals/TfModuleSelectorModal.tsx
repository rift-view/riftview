import React, { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
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

  const isSingleModule = modules.length === 1

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
      tabIndex={-1}
      style={{ zIndex: 200 }}
    >
      <div className="modal modal--md">
        <div className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow">TERRAFORM</span>
            <h2 className="modal-title">Import State</h2>
            <div className="form-helper" style={{ marginTop: 4 }}>
              Found {modules.length} module{modules.length !== 1 ? 's' : ''} · {totalResources}{' '}
              total resource{totalResources !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="modal-close" onClick={onCancel} title="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {!isSingleModule && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 4,
                overflowY: 'auto',
                maxHeight: 280
              }}
            >
              {modules.map((m, idx) => (
                <label
                  key={m.name}
                  className="form-checkbox"
                  style={{
                    display: 'flex',
                    padding: '7px 12px',
                    borderBottom: idx < modules.length - 1 ? '1px solid var(--border)' : 'none',
                    background: checked[m.name] ? 'oklch(0.73 0.17 50 / 0.06)' : 'transparent',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked[m.name] ?? false}
                    onChange={() => toggle(m.name)}
                  />
                  <span style={{ flex: 1, color: 'var(--bone-100)', fontSize: 12 }}>{m.name}</span>
                  <span className="pill pill-neutral" style={{ padding: '1px 6px', fontSize: 9 }}>
                    {m.resourceCount} resource{m.resourceCount !== 1 ? 's' : ''}
                  </span>
                </label>
              ))}
            </div>
          )}

          <div className="form-helper" style={{ marginTop: 10 }}>
            {isSingleModule
              ? `${totalResources} resource${totalResources !== 1 ? 's' : ''} will be imported`
              : `${selectedCount} of ${totalResources} resource${totalResources !== 1 ? 's' : ''} selected`}
          </div>
        </div>

        <div className="modal-foot">
          <button onClick={onCancel} className="btn btn-sm btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={noneSelected}
            className="btn btn-sm btn-primary"
          >
            {isSingleModule ? `Import ${totalResources}` : `Import Selected (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
