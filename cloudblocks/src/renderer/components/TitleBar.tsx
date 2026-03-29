import { useEffect, useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { AwsProfile } from '../types/cloud'
import { computeTidyLayout } from '../utils/tidyLayout'

const LOCAL_PROFILE_NAME = 'local'
const LOCAL_ENDPOINT_DEFAULT = 'http://localhost:4566'

export function TitleBar(): React.JSX.Element {
  const [profiles, setProfiles]             = useState<AwsProfile[]>([])
  const [connStatus, setConnStatus]         = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [endpointInput, setEndpointInput]   = useState<string>(() => useCloudStore.getState().profile.endpoint ?? '')
  const profile         = useCloudStore((s) => s.profile)
  const setProfile      = useCloudStore((s) => s.setProfile)
  const nodes           = useCloudStore((s) => s.nodes)
  const importedNodes   = useCloudStore((s) => s.importedNodes)
  const view            = useUIStore((s) => s.view)
  const applyTidyLayout = useUIStore((s) => s.applyTidyLayout)

  const driftMatched   = nodes.filter((n) => n.driftStatus === 'matched').length
  const driftUnmanaged = nodes.filter((n) => n.driftStatus === 'unmanaged').length
  const driftMissing   = importedNodes.filter((n) => n.driftStatus === 'missing').length
  const driftTotal     = driftMatched + driftMissing

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    const unsub = window.cloudblocks.onConnStatus((status) => {
      setConnStatus(status === 'connected' ? 'connected' : 'error')
    })
    return unsub
  }, [])

  const handleProfileChange = (name: string): void => {
    if (name === LOCAL_PROFILE_NAME) {
      const newProfile: AwsProfile = { name: LOCAL_PROFILE_NAME, endpoint: LOCAL_ENDPOINT_DEFAULT }
      setProfile(newProfile)
      setEndpointInput(LOCAL_ENDPOINT_DEFAULT)
      setConnStatus('unknown')
      window.cloudblocks.selectProfile(newProfile)
    } else {
      const newProfile: AwsProfile = { name }
      setProfile(newProfile)
      setEndpointInput('')
      setConnStatus('unknown')
      window.cloudblocks.selectProfile(newProfile)
    }
  }

  const handleEndpointSubmit = (): void => {
    const trimmed = endpointInput.trim()
    if (!trimmed) return
    const newProfile: AwsProfile = { name: profile.name, endpoint: trimmed }
    setProfile(newProfile)
    setConnStatus('unknown')
    window.cloudblocks.selectProfile(newProfile)
  }

  function handleTidy(): void {
    const viewKey = view === 'topology' ? 'topology' : 'graph'
    const positions = computeTidyLayout(nodes, viewKey)
    applyTidyLayout(viewKey, positions)
    window.dispatchEvent(new CustomEvent('cloudblocks:fitview'))
  }

  async function handleImportTfState(): Promise<void> {
    try {
      const result = await window.cloudblocks.importTfState()
      if (result.error) {
        useUIStore.getState().showToast(result.error, 'error')
        return
      }
      if (result.nodes.length > 0) {
        useCloudStore.getState().setImportedNodes(result.nodes)
        useUIStore.getState().showToast(`Imported ${result.nodes.length} resources from Terraform state`, 'success')
      }
    } catch {
      useUIStore.getState().showToast('Failed to import Terraform state', 'error')
    }
  }

  const statusColor  = connStatus === 'connected' ? '#28c840' : connStatus === 'error' ? '#ff5f57' : '#febc2e'
  const statusLabel  = connStatus === 'connected' ? 'connected' : connStatus === 'error' ? 'error' : 'connecting…'
  const statusGlow   = connStatus === 'connected' ? '0 0 6px #28c840' : 'none'

  const showEndpointInput = profile.endpoint !== undefined

  return (
    <div
      className="flex items-center gap-4 px-3 h-9 flex-shrink-0"
      style={{ background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)' }}
    >
      {/* Traffic lights placeholder for macOS hiddenInset */}
      <div className="flex gap-1.5 mr-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      </div>

      <span className="text-[11px] font-bold tracking-widest font-mono" style={{ color: 'var(--cb-accent)' }}>
        CLOUDBLOCKS
      </span>

      <div className="flex-1" />

      {/* Profile selector */}
      <select
        value={profile.name}
        onChange={(e) => handleProfileChange(e.target.value)}
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)' }}
      >
        {profiles.map((p) => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
        <option disabled>──────────</option>
        <option value={LOCAL_PROFILE_NAME}>⬡ Local</option>
      </select>

      {/* Custom endpoint input — shown when a profile has an endpoint set */}
      {showEndpointInput && (
        <input
          type="text"
          value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleEndpointSubmit() }}
          onBlur={handleEndpointSubmit}
          placeholder={LOCAL_ENDPOINT_DEFAULT}
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{
            background: 'var(--cb-bg-elevated)',
            border: '1px solid var(--cb-border)',
            color: 'var(--cb-text-secondary)',
            width: '160px',
          }}
        />
      )}

      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: statusColor, boxShadow: statusGlow }} />
        <span className="text-[9px] font-mono" style={{ color: statusColor }}>{statusLabel}</span>
      </div>

      {/* TF Import button */}
      <button
        onClick={() => { void handleImportTfState() }}
        title="Import .tfstate file"
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)', cursor: 'pointer' }}
      >
        TF Import
      </button>

      {/* Tidy layout button */}
      <button
        onClick={handleTidy}
        title="Tidy — arrange nodes by service type"
        style={{
          background:  'var(--cb-bg-elevated)',
          border:      '1px solid var(--cb-border)',
          borderRadius: 3,
          padding:     '3px 8px',
          color:       'var(--cb-text-secondary)',
          fontFamily:  'monospace',
          fontSize:    10,
          cursor:      'pointer',
        }}
      >
        Tidy
      </button>

      {/* Drift summary pill — shown after TF import */}
      {importedNodes.length > 0 && (
        <span className="text-[9px] font-mono" style={{ color: 'var(--cb-text-muted)', whiteSpace: 'nowrap' }}>
          {'Imported '}{driftTotal}{' · '}
          <span style={{ color: '#22c55e' }}>✓ {driftMatched}</span>
          {' · '}
          <span style={{ color: '#f59e0b' }}>! {driftUnmanaged}</span>
          {' · '}
          <span style={{ color: '#ef4444' }}>✕ {driftMissing}</span>
        </span>
      )}

      {/* Settings + About */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-settings'))}
        title="Settings"
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)', cursor: 'pointer' }}
      >
        ⚙
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-about'))}
        title="About Cloudblocks"
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)', cursor: 'pointer' }}
      >
        ?
      </button>

    </div>
  )
}
