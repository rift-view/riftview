import { useEffect, useRef, useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { AwsProfile } from '../types/cloud'
import TemplatesModal from './TemplatesModal'
import { getMonthlyEstimate, formatPrice } from '../utils/pricing'

const LOCAL_PROFILE_NAME     = 'local'
const LOCAL_ENDPOINT_DEFAULT = 'http://localhost:4566'

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60)   return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

interface Props {
  onScan: () => void
}

export function TitleBar({ onScan }: Props): React.JSX.Element {
  const [profiles, setProfiles]           = useState<AwsProfile[]>([])
  const [connStatus, setConnStatus]       = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [endpointInput, setEndpointInput] = useState<string>(() => useCloudStore.getState().profile.endpoint ?? '')
  const [importOpen, setImportOpen]       = useState(false)
  const [exportOpen, setExportOpen]       = useState(false)
  const [, forceUpdate]                   = useState(0)

  const profile       = useCloudStore((s) => s.profile)
  const setProfile    = useCloudStore((s) => s.setProfile)
  const nodes         = useCloudStore((s) => s.nodes)
  const scanStatus    = useCloudStore((s) => s.scanStatus)
  const lastScannedAt = useCloudStore((s) => s.lastScannedAt)

  const [showTemplates, setShowTemplates] = useState(false)
  const importRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const totalCost = nodes.reduce((sum, n) => {
    const est = getMonthlyEstimate(n.type, n.region ?? 'us-east-1')
    return sum + (est ?? 0)
  }, 0)

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    const unsub = window.cloudblocks.onConnStatus((status) => {
      setConnStatus(status === 'connected' ? 'connected' : 'error')
    })
    return unsub
  }, [])

  // Refresh relative timestamp every 10 seconds
  useEffect(() => {
    if (!lastScannedAt) return
    const id = setInterval(() => forceUpdate(n => n + 1), 10_000)
    return () => clearInterval(id)
  }, [lastScannedAt])

  useEffect(() => {
    const handler = (): void => setShowTemplates(true)
    window.addEventListener('cloudblocks:show-templates', handler)
    return () => window.removeEventListener('cloudblocks:show-templates', handler)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!importOpen && !exportOpen) return
    function onClickOutside(e: MouseEvent): void {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false)
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [importOpen, exportOpen])

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

  async function handleImportTfState(): Promise<void> {
    setImportOpen(false)
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

  const statusColor = connStatus === 'connected' ? '#28c840' : connStatus === 'error' ? '#ff5f57' : '#febc2e'
  const statusLabel = connStatus === 'connected' ? 'connected' : connStatus === 'error' ? 'error' : 'connecting…'
  const statusGlow  = connStatus === 'connected' ? '0 0 6px #28c840' : 'none'
  const showEndpointInput = profile.endpoint !== undefined

  const btnBase: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 10, borderRadius: 4,
    padding: '2px 8px', cursor: 'pointer',
    background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)',
    color: 'var(--cb-text-secondary)',
  }
  const dropdownMenu: React.CSSProperties = {
    position: 'absolute', top: '100%', marginTop: 4, zIndex: 200,
    background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border-strong)',
    borderRadius: 4, overflow: 'hidden', minWidth: 150,
  }
  const dropdownItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', textAlign: 'left',
    background: 'none', border: 'none', borderBottom: '1px solid var(--cb-border)',
    padding: '6px 12px', fontFamily: 'monospace', fontSize: 10,
    color: 'var(--cb-text-secondary)', cursor: 'pointer',
  }

  return (
    <div
      className="flex items-center gap-2 px-3 h-9 flex-shrink-0"
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

      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--cb-border-strong)' }} />

      {/* Scan group */}
      <button
        onClick={onScan}
        disabled={scanStatus === 'scanning'}
        style={{ ...btnBase, border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)', opacity: scanStatus === 'scanning' ? 0.5 : 1 }}
      >
        {scanStatus === 'scanning' ? '⟳ Scanning…' : '⟳ Scan'}
      </button>

      {lastScannedAt && (
        <span style={{ fontSize: 11, color: 'var(--cb-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {relativeTime(lastScannedAt)}
        </span>
      )}

      {nodes.length > 0 && (
        <span style={{
          fontSize: 11, color: '#22c55e', fontFamily: 'monospace', whiteSpace: 'nowrap',
          padding: '1px 6px', borderRadius: 3,
          border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)',
        }}>
          {formatPrice(totalCost)}
        </span>
      )}

      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--cb-border-strong)' }} />

      {/* Import dropdown */}
      <div ref={importRef} style={{ position: 'relative' }}>
        <button onClick={() => setImportOpen((o) => !o)} style={btnBase}>↑ Import ▾</button>
        {importOpen && (
          <div style={{ ...dropdownMenu, left: 0 }}>
            <button style={dropdownItem} onClick={() => { void handleImportTfState() }}>
              <span>⬡</span>
              <span style={{ flex: 1 }}>Terraform</span>
              <span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>.tfstate</span>
            </button>
            <button
              style={dropdownItem}
              onClick={() => { setImportOpen(false); window.dispatchEvent(new CustomEvent('cloudblocks:show-templates')) }}
            >
              <span>⊞</span>
              <span style={{ flex: 1 }}>Templates</span>
            </button>
            <button
              style={{ ...dropdownItem, borderBottom: 'none' }}
              onClick={() => { setImportOpen(false); useUIStore.getState().showToast('SAM import coming soon', 'error') }}
            >
              <span>⬡</span>
              <span style={{ flex: 1 }}>SAM</span>
              <span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>template.yaml</span>
            </button>
          </div>
        )}
      </div>

      {/* Export dropdown */}
      <div ref={exportRef} style={{ position: 'relative' }}>
        <button onClick={() => setExportOpen((o) => !o)} style={btnBase}>↓ Export ▾</button>
        {exportOpen && (
          <div style={{ ...dropdownMenu, right: 0 }}>
            <button
              onClick={() => {
                setExportOpen(false)
                window.cloudblocks.exportTerraform(nodes).then((res) => {
                  if (res.success) {
                    if (res.skippedTypes && res.skippedTypes.length > 0) {
                      useUIStore.getState().showToast(`Exported. Skipped: ${res.skippedTypes.join(', ')}`, 'error')
                    } else {
                      useUIStore.getState().showToast('HCL exported', 'success')
                    }
                  }
                }).catch(() => useUIStore.getState().showToast('Export failed', 'error'))
              }}
              disabled={nodes.length === 0}
              style={{
                ...dropdownItem,
                color: nodes.length === 0 ? 'var(--cb-text-muted)' : 'var(--cb-text-secondary)',
                cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ⬡ Terraform HCL
            </button>
            <button
              onClick={() => {
                setExportOpen(false)
                window.cloudblocks.exportPng().then((res) => {
                  if (res.success) useUIStore.getState().showToast('PNG exported', 'success')
                  else useUIStore.getState().showToast('Export cancelled', 'error')
                }).catch(() => useUIStore.getState().showToast('Export failed', 'error'))
              }}
              style={{ ...dropdownItem, borderBottom: 'none' }}
            >
              ↓ PNG
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-4 flex-shrink-0" style={{ background: 'var(--cb-border-strong)' }} />

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-settings'))}
        title="Settings"
        style={btnBase}
      >
        ⚙
      </button>
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-about'))}
        title="About Cloudblocks"
        style={btnBase}
      >
        ?
      </button>

      {showTemplates && (
        <TemplatesModal onClose={() => setShowTemplates(false)} />
      )}
    </div>
  )
}
