import React, { useEffect, useState } from 'react'
import { useCloudStore, Settings } from '../store/cloud'
import type { Theme } from '../types/cloud'
import { applyTheme } from '../utils/applyTheme'

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
      applyTheme(local.theme)
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

  const THEME_META: Record<Theme, { label: string; accent: string }> = {
    dark: { label: 'Dark', accent: '#FF9900' },
    light: { label: 'Light', accent: '#e07800' },
    solarized: { label: 'Solarized Dark', accent: '#2aa198' },
    'rose-pine': { label: 'Rosé Pine', accent: '#eb6f92' },
    catppuccin: { label: 'Catppuccin Mocha', accent: '#fab387' },
    'solarized-light': { label: 'Solarized Light', accent: '#268bd2' },
    'github-light': { label: 'GitHub Light', accent: '#0969da' },
    'nord-light': { label: 'Nord Light', accent: '#5e81ac' },
    'gruvbox-dark': { label: 'Gruvbox Dark', accent: '#fe8019' },
    'gruvbox-light': { label: 'Gruvbox Light', accent: '#d65d0e' }
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

        {/* Theme */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 9,
              color: 'var(--fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6
            }}
          >
            Theme
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(Object.entries(THEME_META) as [Theme, { label: string; accent: string }][]).map(
              ([t, { label, accent }]) => (
                <button
                  key={t}
                  onClick={() => setLocal((f) => ({ ...f, theme: t }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 10px',
                    borderRadius: 3,
                    border: `1px solid ${local.theme === t ? accent : 'var(--border)'}`,
                    background: local.theme === t ? 'var(--ember-glow)' : 'transparent',
                    color: local.theme === t ? accent : 'var(--bone-200)',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: accent,
                      flexShrink: 0,
                      display: 'inline-block'
                    }}
                  />
                  {label}
                </button>
              )
            )}
          </div>
        </div>

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
