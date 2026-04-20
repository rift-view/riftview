import React, { useEffect, useState } from 'react'
import { useCloudStore, Settings } from '../store/cloud'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const { settings, saveSettings } = useCloudStore()
  const [local, setLocal] = useState<Settings>(settings)

  useEffect(() => {
    setLocal(settings)
  }, [settings])

  const update = <K extends keyof Settings>(key: K, val: Settings[K]): void =>
    setLocal((prev) => ({ ...prev, [key]: val }))

  const handleSave = async (): Promise<void> => {
    try {
      await saveSettings(local)
    } finally {
      onClose()
    }
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
  const panel: React.CSSProperties = {
    background: 'var(--ink-900)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 24,
    width: 400,
    fontFamily: 'monospace',
    color: 'var(--fg)'
  }
  const label: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--bone-200)',
    textTransform: 'uppercase',
    marginBottom: 4
  }
  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--ink-900)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '4px 8px',
    color: 'var(--fg)',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 16
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={panel}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 'bold',
            color: 'var(--accent)',
            marginBottom: 20,
            borderBottom: '1px solid var(--border-strong)',
            paddingBottom: 8
          }}
        >
          Settings
        </div>

        <div style={label}>Delete confirmation style</div>
        <select
          style={selectStyle}
          value={local.deleteConfirmStyle}
          onChange={(e) =>
            update('deleteConfirmStyle', e.target.value as Settings['deleteConfirmStyle'])
          }
        >
          <option value="type-to-confirm">Type to confirm</option>
          <option value="command-drawer">Command Drawer</option>
        </select>

        <div style={label}>Scan interval</div>
        <select
          style={selectStyle}
          value={String(local.scanInterval)}
          onChange={(e) => {
            const v = e.target.value
            update('scanInterval', v === 'manual' ? 'manual' : (Number(v) as 15 | 30 | 60))
          }}
        >
          <option value="15">15s</option>
          <option value="30">30s</option>
          <option value="60">60s</option>
          <option value="manual">Manual only</option>
        </select>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--ink-850)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '4px 16px',
              color: 'var(--bone-200)',
              fontFamily: 'monospace',
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: '#22c55e',
              border: 'none',
              borderRadius: 3,
              padding: '4px 16px',
              color: '#000',
              fontFamily: 'monospace',
              fontSize: 11,
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
