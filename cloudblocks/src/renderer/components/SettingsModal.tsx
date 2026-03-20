import React, { useEffect, useState, useCallback } from 'react'
import { useCloudStore } from '../store/cloud'
import type { Settings, Theme, AwsProfile } from '../types/cloud'
import { applyTheme } from '../utils/applyTheme'

interface SettingsModalProps {
  onClose: () => void
}

type TabKey = 'profile' | 'regions' | 'appearance' | 'localstack'

const ALL_REGIONS: string[] = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
]

const THEME_META: Record<Theme, { label: string; accent: string }> = {
  dark:          { label: 'Dark',             accent: '#FF9900' },
  light:         { label: 'Light',            accent: '#e07800' },
  solarized:     { label: 'Solarized Dark',   accent: '#2aa198' },
  'rose-pine':   { label: 'Rosé Pine',        accent: '#eb6f92' },
  catppuccin:    { label: 'Catppuccin Mocha', accent: '#fab387' },
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile',     label: 'Profile'    },
  { key: 'regions',     label: 'Regions'    },
  { key: 'appearance',  label: 'Appearance' },
  { key: 'localstack',  label: 'LocalStack' },
]

export function SettingsModal({ onClose }: SettingsModalProps): React.JSX.Element {
  const profile          = useCloudStore((s) => s.profile)
  const setProfile       = useCloudStore((s) => s.setProfile)
  const settings         = useCloudStore((s) => s.settings)
  const saveSettings     = useCloudStore((s) => s.saveSettings)
  const selectedRegions  = useCloudStore((s) => s.selectedRegions)
  const setSelectedRegions = useCloudStore((s) => s.setSelectedRegions)

  const [tab, setTab]               = useState<TabKey>('profile')
  const [awsProfiles, setAwsProfiles] = useState<string[]>(['default'])
  const [endpointInput, setEndpointInput] = useState<string>(profile.endpoint ?? '')

  useEffect(() => {
    window.cloudblocks.listAwsProfiles().then(setAwsProfiles).catch(() => setAwsProfiles(['default']))
  }, [])

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  function handleProfileSelect(name: string): void {
    const next: AwsProfile = { name, endpoint: profile.endpoint }
    setProfile(next)
  }

  function handleThemeSelect(theme: Theme): void {
    const next: Settings = { ...settings, theme }
    applyTheme(theme)
    saveSettings(next).catch(() => {/* best-effort */})
  }

  function toggleRegion(region: string): void {
    const next = selectedRegions.includes(region)
      ? selectedRegions.filter((r) => r !== region)
      : [...selectedRegions, region]
    // Keep at least one region selected
    if (next.length === 0) return
    setSelectedRegions(next)
  }

  function handleEndpointSave(): void {
    const trimmed = endpointInput.trim()
    setProfile({ ...profile, endpoint: trimmed || undefined })
  }

  function handleEndpointClear(): void {
    setEndpointInput('')
    setProfile({ ...profile, endpoint: undefined })
  }

  const overlay: React.CSSProperties = {
    position:        'fixed',
    inset:           0,
    background:      'rgba(0,0,0,0.75)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    zIndex:          300,
  }

  const modal: React.CSSProperties = {
    background:     'var(--cb-bg-panel)',
    border:         '1px solid var(--cb-border-strong)',
    borderRadius:   8,
    width:          640,
    maxHeight:      '80vh',
    display:        'flex',
    flexDirection:  'column',
    fontFamily:     'monospace',
    overflow:       'hidden',
  }

  const header: React.CSSProperties = {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '14px 20px',
    borderBottom:   '1px solid var(--cb-border-strong)',
    flexShrink:     0,
  }

  const body: React.CSSProperties = {
    display:    'flex',
    flex:       1,
    overflow:   'hidden',
    minHeight:  0,
  }

  const sidebar: React.CSSProperties = {
    width:          130,
    borderRight:    '1px solid var(--cb-border)',
    padding:        '12px 0',
    flexShrink:     0,
    display:        'flex',
    flexDirection:  'column',
    gap:            2,
  }

  const content: React.CSSProperties = {
    flex:       1,
    padding:    '20px 24px',
    overflowY:  'auto',
  }

  function tabBtn(key: TabKey): React.CSSProperties {
    const active = tab === key
    return {
      display:        'block',
      width:          '100%',
      padding:        '6px 16px',
      textAlign:      'left',
      fontFamily:     'monospace',
      fontSize:       11,
      cursor:         'pointer',
      border:         'none',
      borderLeft:     active ? '2px solid var(--cb-accent)' : '2px solid transparent',
      background:     active ? 'var(--cb-accent-subtle)' : 'transparent',
      color:          active ? 'var(--cb-accent)' : 'var(--cb-text-secondary)',
    }
  }

  const sectionLabel: React.CSSProperties = {
    fontSize:        9,
    color:           'var(--cb-text-muted)',
    textTransform:   'uppercase',
    letterSpacing:   '0.08em',
    marginBottom:    10,
  }

  const noteStyle: React.CSSProperties = {
    fontSize:    10,
    color:       'var(--cb-text-muted)',
    marginTop:   14,
    lineHeight:  1.6,
  }

  const amberNote: React.CSSProperties = {
    fontSize:     10,
    color:        '#f59e0b',
    background:   'rgba(251,191,36,0.08)',
    border:       '1px solid rgba(251,191,36,0.25)',
    borderRadius: 4,
    padding:      '6px 10px',
    marginTop:    14,
    lineHeight:   1.6,
  }

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    background:   'var(--cb-bg-elevated)',
    border:       '1px solid var(--cb-border-strong)',
    borderRadius: 4,
    padding:      '5px 10px',
    color:        'var(--cb-text-primary)',
    fontFamily:   'monospace',
    fontSize:     11,
    boxSizing:    'border-box',
  }

  const btnSecondary: React.CSSProperties = {
    background:   'var(--cb-bg-elevated)',
    border:       '1px solid var(--cb-border)',
    borderRadius: 4,
    padding:      '4px 14px',
    color:        'var(--cb-text-secondary)',
    fontFamily:   'monospace',
    fontSize:     11,
    cursor:       'pointer',
  }

  const btnDanger: React.CSSProperties = {
    background:   'transparent',
    border:       '1px solid #ef4444',
    borderRadius: 4,
    padding:      '4px 14px',
    color:        '#ef4444',
    fontFamily:   'monospace',
    fontSize:     11,
    cursor:       'pointer',
  }

  return (
    <div
      style={overlay}
      onClick={(e): void => { if (e.target === e.currentTarget) onClose() }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-accent)', letterSpacing: '0.04em' }}>
            Settings
          </span>
          <button
            onClick={onClose}
            style={{ ...btnSecondary, padding: '2px 10px', fontSize: 12 }}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={body}>
          {/* Sidebar */}
          <div style={sidebar}>
            {TABS.map(({ key, label }) => (
              <button key={key} style={tabBtn(key)} onClick={(): void => setTab(key)}>
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={content}>

            {/* ── Profile tab ── */}
            {tab === 'profile' && (
              <div>
                <div style={sectionLabel}>AWS Credential Profile</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {awsProfiles.map((name) => {
                    const active = name === profile.name
                    return (
                      <button
                        key={name}
                        onClick={(): void => handleProfileSelect(name)}
                        style={{
                          display:      'flex',
                          alignItems:   'center',
                          gap:          10,
                          padding:      '6px 12px',
                          borderRadius: 4,
                          border:       `1px solid ${active ? 'var(--cb-accent)' : 'var(--cb-border)'}`,
                          background:   active ? 'var(--cb-accent-subtle)' : 'transparent',
                          color:        active ? 'var(--cb-accent)' : 'var(--cb-text-secondary)',
                          fontFamily:   'monospace',
                          fontSize:     11,
                          cursor:       'pointer',
                          textAlign:    'left',
                        }}
                      >
                        <span style={{
                          width:        8,
                          height:       8,
                          borderRadius: '50%',
                          background:   active ? 'var(--cb-accent)' : 'var(--cb-border-strong)',
                          flexShrink:   0,
                        }} />
                        {name}
                        {active && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--cb-accent)', opacity: 0.75 }}>
                            active
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <div style={noteStyle}>
                  To add a profile, run{' '}
                  <code style={{ color: 'var(--cb-text-primary)', background: 'var(--cb-bg-elevated)', padding: '1px 4px', borderRadius: 3 }}>
                    aws configure --profile &lt;name&gt;
                  </code>
                  {' '}in your terminal, then reopen Settings.
                </div>
              </div>
            )}

            {/* ── Regions tab ── */}
            {tab === 'regions' && (
              <div>
                <div style={sectionLabel}>Scan Regions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ALL_REGIONS.map((region) => {
                    const checked = selectedRegions.includes(region)
                    return (
                      <label
                        key={region}
                        style={{
                          display:      'flex',
                          alignItems:   'center',
                          gap:          10,
                          cursor:       'pointer',
                          padding:      '4px 8px',
                          borderRadius: 4,
                          border:       `1px solid ${checked ? 'var(--cb-accent)' : 'var(--cb-border)'}`,
                          background:   checked ? 'var(--cb-accent-subtle)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(): void => toggleRegion(region)}
                          style={{ accentColor: 'var(--cb-accent)', cursor: 'pointer' }}
                        />
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize:   11,
                          color:      checked ? 'var(--cb-accent)' : 'var(--cb-text-secondary)',
                        }}>
                          {region}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <div style={noteStyle}>
                  Selected regions are used when &quot;Scan All Selected&quot; is triggered.
                  Currently scanning: <strong style={{ color: 'var(--cb-text-primary)' }}>{useCloudStore.getState().region}</strong>
                </div>
              </div>
            )}

            {/* ── Appearance tab ── */}
            {tab === 'appearance' && (
              <div>
                <div style={sectionLabel}>Theme</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(Object.entries(THEME_META) as [Theme, { label: string; accent: string }][]).map(([theme, { label, accent }]) => {
                    const active = settings.theme === theme
                    return (
                      <button
                        key={theme}
                        onClick={(): void => handleThemeSelect(theme)}
                        style={{
                          display:      'flex',
                          alignItems:   'center',
                          gap:          10,
                          padding:      '6px 12px',
                          borderRadius: 4,
                          border:       `1px solid ${active ? accent : 'var(--cb-border)'}`,
                          background:   active ? 'var(--cb-accent-subtle)' : 'transparent',
                          color:        active ? accent : 'var(--cb-text-secondary)',
                          fontFamily:   'monospace',
                          fontSize:     11,
                          cursor:       'pointer',
                          textAlign:    'left',
                        }}
                      >
                        <span style={{
                          width:        10,
                          height:       10,
                          borderRadius: '50%',
                          background:   accent,
                          flexShrink:   0,
                          display:      'inline-block',
                        }} />
                        {label}
                        {active && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.75 }}>active</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── LocalStack tab ── */}
            {tab === 'localstack' && (
              <div>
                <div style={sectionLabel}>Local Endpoint</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    value={endpointInput}
                    onChange={(e): void => setEndpointInput(e.target.value)}
                    onKeyDown={(e): void => { if (e.key === 'Enter') handleEndpointSave() }}
                    placeholder="http://localhost:4566"
                    style={inputStyle}
                    spellCheck={false}
                  />
                  <button onClick={handleEndpointSave} style={btnSecondary}>Set</button>
                  <button onClick={handleEndpointClear} style={btnDanger}>Clear</button>
                </div>
                {profile.endpoint && (
                  <div style={{ marginTop: 8, fontSize: 10, color: '#f59e0b', fontFamily: 'monospace' }}>
                    Active: {profile.endpoint}
                  </div>
                )}
                <div style={amberNote}>
                  When an endpoint is set, all CLI commands route to the local emulator with test credentials (key: <code>test</code>).
                  Real AWS credentials are never used for local calls.
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
