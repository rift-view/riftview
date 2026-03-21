import { useEffect, useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { AwsProfile } from '../types/cloud'

const LOCAL_PROFILE_NAME = 'local'
const LOCAL_ENDPOINT_DEFAULT = 'http://localhost:4566'

const REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1',
  'ap-southeast-1','ap-northeast-1',
]

interface TitleBarProps {
  onSettingsOpen: () => void
}

export function TitleBar({ onSettingsOpen }: TitleBarProps): React.JSX.Element {
  const [profiles, setProfiles]             = useState<AwsProfile[]>([])
  const [connStatus, setConnStatus]         = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [endpointInput, setEndpointInput]   = useState<string>(() => useCloudStore.getState().profile.endpoint ?? '')
  const profile    = useCloudStore((s) => s.profile)
  const region     = useCloudStore((s) => s.region)
  const setProfile = useCloudStore((s) => s.setProfile)
  const setRegion  = useCloudStore((s) => s.setRegion)

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

  const handleRegionChange = (r: string): void => {
    setRegion(r)
    setConnStatus('unknown')
    window.cloudblocks.selectRegion(r, profile.endpoint)
  }

  const handleEndpointSubmit = (): void => {
    const trimmed = endpointInput.trim()
    if (!trimmed) return
    const newProfile: AwsProfile = { name: profile.name, endpoint: trimmed }
    setProfile(newProfile)
    setConnStatus('unknown')
    window.cloudblocks.selectProfile(newProfile)
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

      {/* Region selector */}
      <select
        value={region}
        onChange={(e) => handleRegionChange(e.target.value)}
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}
      >
        {REGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

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

      {/* Settings gear */}
      <button
        onClick={onSettingsOpen}
        title="Settings"
        style={{
          background: 'none', border: 'none', color: 'var(--cb-text-secondary)', cursor: 'pointer',
          fontSize: 14, padding: '0 8px', marginLeft: 'auto',
        }}
      >
        ⚙
      </button>
    </div>
  )
}
