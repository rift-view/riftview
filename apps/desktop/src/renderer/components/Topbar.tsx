import { useEffect, useRef, useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { AwsProfile, CloudNode } from '@riftview/shared'
import type { TfModuleInfo } from '../types/tfstate'
import TemplatesModal from './TemplatesModal'
import TfModuleSelectorModal from './modals/TfModuleSelectorModal'
import { getMonthlyEstimate, formatPrice } from '../utils/pricing'
import { buildRegionColorMap } from '../utils/regionColors'
import logoUrl from '../assets/riftview-logo.jpg'

const LOCAL_PROFILE_NAME = 'local'
const LOCAL_ENDPOINT_DEFAULT = 'http://localhost:4566'

const ALL_REGIONS = [
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
  'ap-south-1',
  'sa-east-1',
  'ca-central-1'
]

function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

interface Props {
  onScan: () => void
  fixCount?: number
}

export function Topbar({ onScan, fixCount = 0 }: Props): React.JSX.Element {
  const [profiles, setProfiles] = useState<AwsProfile[]>([])
  const [connStatus, setConnStatus] = useState<'unknown' | 'connected' | 'error'>('unknown')
  const [endpointInput, setEndpointInput] = useState<string>(
    () => useCloudStore.getState().profile.endpoint ?? ''
  )
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [addRegionOpen, setAddRegionOpen] = useState(false)
  const [, forceUpdate] = useState(0)

  const profile = useCloudStore((s) => s.profile)
  const setProfile = useCloudStore((s) => s.setProfile)
  const nodes = useCloudStore((s) => s.nodes)
  const scanStatus = useCloudStore((s) => s.scanStatus)
  const lastScannedAt = useCloudStore((s) => s.lastScannedAt)
  const selectedRegions = useCloudStore((s) => s.selectedRegions)
  const setSelectedRegions = useCloudStore((s) => s.setSelectedRegions)
  const regionColors = useCloudStore((s) => s.settings.regionColors)
  const isExporting = useUIStore((s) => s.isExporting)

  const [showTemplates, setShowTemplates] = useState(false)
  const [costHover, setCostHover] = useState(false)
  const [tfModules, setTfModules] = useState<TfModuleInfo[] | null>(null)
  const importRef = useRef<HTMLDivElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const addRegionRef = useRef<HTMLDivElement>(null)

  const totalCost = nodes.reduce((sum, n) => {
    const est = getMonthlyEstimate(n.type, n.region ?? 'us-east-1')
    return sum + (est ?? 0)
  }, 0)

  useEffect(() => {
    window.riftview.listProfiles().then(setProfiles)
    const unsub = window.riftview.onConnStatus((status) => {
      setConnStatus(status === 'connected' ? 'connected' : 'error')
    })
    return unsub
  }, [])

  // Refresh relative timestamp every 10 seconds
  useEffect(() => {
    if (!lastScannedAt) return
    const id = setInterval(() => forceUpdate((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [lastScannedAt])

  useEffect(() => {
    const handler = (): void => setShowTemplates(true)
    window.addEventListener('riftview:show-templates', handler)
    return () => window.removeEventListener('riftview:show-templates', handler)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!importOpen && !exportOpen && !addRegionOpen) return
    function onClickOutside(e: MouseEvent): void {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false)
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
      if (addRegionRef.current && !addRegionRef.current.contains(e.target as Node))
        setAddRegionOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [importOpen, exportOpen, addRegionOpen])

  const handleProfileChange = (name: string): void => {
    if (name === LOCAL_PROFILE_NAME) {
      const newProfile: AwsProfile = { name: LOCAL_PROFILE_NAME, endpoint: LOCAL_ENDPOINT_DEFAULT }
      setProfile(newProfile)
      setEndpointInput(LOCAL_ENDPOINT_DEFAULT)
      setConnStatus('unknown')
      window.riftview.selectProfile(newProfile)
    } else {
      const newProfile: AwsProfile = { name }
      setProfile(newProfile)
      setEndpointInput('')
      setConnStatus('unknown')
      window.riftview.selectProfile(newProfile)
    }
  }

  const handleEndpointSubmit = (): void => {
    const trimmed = endpointInput.trim()
    if (!trimmed) return
    const newProfile: AwsProfile = { name: profile.name, endpoint: trimmed }
    setProfile(newProfile)
    setConnStatus('unknown')
    window.riftview.selectProfile(newProfile)
  }

  function applyImportedNodes(selectedNodes: CloudNode[]): void {
    if (selectedNodes.length === 0) return
    useCloudStore.getState().setImportedNodes(selectedNodes)
    window.dispatchEvent(new CustomEvent('riftview:fitview'))
    useUIStore
      .getState()
      .showToast(`Imported ${selectedNodes.length} resources from Terraform state`, 'success')
  }

  async function handleImportTfState(): Promise<void> {
    setImportOpen(false)
    try {
      const result = await window.riftview.listTfStateModules()
      if (!result.modules || result.modules.length === 0) {
        const fallback = await window.riftview.importTfState()
        if (fallback.error) {
          useUIStore.getState().showToast(fallback.error, 'error')
          return
        }
        applyImportedNodes(fallback.nodes)
        return
      }
      if (result.modules.length === 1) {
        applyImportedNodes(result.modules[0].nodes)
        return
      }
      setTfModules(result.modules)
    } catch {
      useUIStore.getState().showToast('Failed to import Terraform state', 'error')
    }
  }

  function handleModuleConfirm(selectedNodes: CloudNode[]): void {
    setTfModules(null)
    applyImportedNodes(selectedNodes)
  }

  function handleModuleCancel(): void {
    setTfModules(null)
  }

  function removeRegion(r: string): void {
    if (selectedRegions.length <= 1) return
    const next = selectedRegions.filter((x) => x !== r)
    setSelectedRegions(next)
    window.riftview.startScan(next)
  }

  function addRegion(r: string): void {
    const next = [...selectedRegions, r]
    setSelectedRegions(next)
    window.riftview.startScan(next)
    setAddRegionOpen(false)
  }

  const colorMap = buildRegionColorMap(selectedRegions, regionColors)
  const showColors = selectedRegions.length >= 2
  const availableRegions = ALL_REGIONS.filter((r) => !selectedRegions.includes(r))
  const showEndpointInput = profile.endpoint !== undefined

  const nodesWithCost = nodes
    .map((n) => ({
      id: n.id,
      label: n.label ?? n.id,
      type: n.type,
      cost: getMonthlyEstimate(n.type, n.region ?? 'us-east-1') ?? 0
    }))
    .filter((n) => n.cost > 0)
    .sort((a, b) => b.cost - a.cost)
  const top5 = nodesWithCost.slice(0, 5)
  const remainder = nodesWithCost.length - top5.length
  const hasCostPopover = top5.length > 0

  // ---- Inline styles ----

  const hairlineStyle: React.CSSProperties = {
    width: 1,
    height: 20,
    background: 'var(--ink-800)',
    flexShrink: 0
  }

  const clusterStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-elev-1)',
    color: 'var(--fg-strong)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-micro)',
    cursor: 'pointer',
    outline: 'none'
  }

  const endpointInputStyle: React.CSSProperties = {
    background: 'var(--ink-900)',
    border: '1px solid var(--ink-700)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--fg)',
    padding: '4px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-micro)',
    width: 170,
    outline: 'none'
  }

  const monoMeta: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--fg-dim)',
    whiteSpace: 'nowrap'
  }

  const fixChipStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    color: 'var(--moss-500)',
    whiteSpace: 'nowrap'
  }

  const dropdownMenuPosition = (anchor: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: '100%',
    marginTop: 4,
    zIndex: 'var(--z-overlay)' as unknown as number,
    [anchor]: 0
  })

  const connectionPillClass =
    connStatus === 'connected'
      ? 'pill pill-ok'
      : connStatus === 'error'
        ? 'pill pill-danger'
        : 'pill'

  const connectionLabel =
    connStatus === 'connected' ? 'CONNECTED' : connStatus === 'error' ? 'ERROR' : 'CONNECTING'

  const connectionLabelColor =
    connStatus === 'connected'
      ? 'var(--moss-500)'
      : connStatus === 'error'
        ? 'var(--fault-500)'
        : undefined

  // Inline override for the unknown state → amber per design
  const unknownDotStyle: React.CSSProperties | undefined =
    connStatus === 'unknown'
      ? { background: 'oklch(.72 .15 75)', boxShadow: '0 0 8px oklch(.72 .15 75)' }
      : undefined

  return (
    <div className="rift-topbar">
      {/* ========== LEFT CLUSTER ========== */}
      <div style={clusterStyle}>
        {/* Traffic-light placeholder dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 4 }}>
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'oklch(0.55 0.18 28)',
              display: 'inline-block'
            }}
          />
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'oklch(0.72 0.15 75)',
              display: 'inline-block'
            }}
          />
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'oklch(0.70 0.14 150)',
              display: 'inline-block'
            }}
          />
        </div>

        {/* Wordmark */}
        <span className="wordmark">
          <img src={logoUrl} alt="" />
          <span>RIFTVIEW</span>
        </span>
      </div>

      {/* ========== CENTER CLUSTER ========== */}
      <div
        style={{
          ...clusterStyle,
          justifyContent: 'center',
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        {/* Profile selector */}
        <select
          aria-label="profile"
          value={profile.name}
          onChange={(e) => handleProfileChange(e.target.value)}
          style={selectStyle}
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
          <option disabled>──────────</option>
          <option value={LOCAL_PROFILE_NAME}>⬡ Local</option>
        </select>

        <div style={hairlineStyle} />

        {showEndpointInput && (
          <>
            <input
              type="text"
              value={endpointInput}
              onChange={(e) => setEndpointInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEndpointSubmit()
              }}
              onBlur={handleEndpointSubmit}
              placeholder={LOCAL_ENDPOINT_DEFAULT}
              style={endpointInputStyle}
            />
            <div style={hairlineStyle} />
          </>
        )}

        {/* Connection status pill */}
        <span className={connectionPillClass} style={{ letterSpacing: 'var(--tracking-loud)' }}>
          <span className="dot" style={unknownDotStyle} />
          <span style={{ color: connectionLabelColor }}>{connectionLabel}</span>
        </span>

        <div style={hairlineStyle} />

        {/* Last-scanned */}
        {lastScannedAt && <span style={monoMeta}>{relativeTime(lastScannedAt)}</span>}

        {fixCount > 0 && <span style={fixChipStyle}>✓ {fixCount} fixed this session</span>}

        <div style={hairlineStyle} />

        {/* Region chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {selectedRegions.map((r) => (
            <span
              key={r}
              className="region-chip"
              style={showColors ? { borderColor: colorMap[r] } : undefined}
            >
              {showColors && (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: colorMap[r],
                    flexShrink: 0
                  }}
                />
              )}
              {r}
              {selectedRegions.length > 1 && (
                <button
                  onClick={() => removeRegion(r)}
                  aria-label={`remove ${r}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    marginLeft: 2,
                    color: 'var(--fg-dim)',
                    cursor: 'pointer',
                    fontSize: 11,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              )}
            </span>
          ))}

          {availableRegions.length > 0 && (
            <div ref={addRegionRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setAddRegionOpen((o) => !o)}
                style={{
                  background: 'transparent',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '2px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-micro)',
                  color: 'var(--fg-muted)',
                  cursor: 'pointer'
                }}
              >
                + add
              </button>
              {addRegionOpen && (
                <div
                  className="rift-dropdown-menu"
                  style={{ ...dropdownMenuPosition('left'), minWidth: 140 }}
                >
                  {availableRegions.map((r) => (
                    <button key={r} onClick={() => addRegion(r)} className="rift-dropdown-item">
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========== RIGHT CLUSTER ========== */}
      <div style={clusterStyle}>
        {/* Import dropdown */}
        <div ref={importRef} style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setImportOpen((o) => !o)}>
            <span aria-hidden>↑</span>
            <span>Import</span>
            <span aria-hidden>▾</span>
          </button>
          {importOpen && (
            <div className="rift-dropdown-menu" style={dropdownMenuPosition('left')}>
              <button
                className="rift-dropdown-item"
                onClick={() => {
                  void handleImportTfState()
                }}
              >
                <span aria-hidden>⬡</span>
                <span style={{ flex: 1 }}>Terraform</span>
                <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>.tfstate</span>
              </button>
              <button
                className="rift-dropdown-item"
                onClick={() => {
                  setImportOpen(false)
                  window.dispatchEvent(new CustomEvent('riftview:show-templates'))
                }}
              >
                <span aria-hidden>⊞</span>
                <span style={{ flex: 1 }}>Templates</span>
              </button>
              <button
                className="rift-dropdown-item"
                onClick={() => {
                  setImportOpen(false)
                  useUIStore.getState().showToast('SAM import coming soon', 'error')
                }}
              >
                <span aria-hidden>⬡</span>
                <span style={{ flex: 1 }}>SAM</span>
                <span style={{ fontSize: 9, color: 'var(--fg-dim)' }}>template.yaml</span>
              </button>
            </div>
          )}
        </div>

        {/* Export dropdown */}
        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (!isExporting) setExportOpen((o) => !o)
            }}
            style={{ opacity: isExporting ? 0.5 : 1 }}
          >
            <span aria-hidden>↓</span>
            <span>{isExporting ? 'Exporting…' : 'Export'}</span>
            {!isExporting && <span aria-hidden>▾</span>}
          </button>
          {exportOpen && !isExporting && (
            <div className="rift-dropdown-menu" style={dropdownMenuPosition('right')}>
              <button
                className="rift-dropdown-item"
                disabled={nodes.length === 0}
                onClick={() => {
                  setExportOpen(false)
                  window.riftview
                    .exportTerraform(nodes)
                    .then((res) => {
                      if (res.success) {
                        if (res.skippedTypes && res.skippedTypes.length > 0) {
                          useUIStore
                            .getState()
                            .showToast(`Exported. Skipped: ${res.skippedTypes.join(', ')}`, 'error')
                        } else {
                          useUIStore.getState().showToast('HCL exported', 'success')
                        }
                      }
                    })
                    .catch(() => useUIStore.getState().showToast('Export failed', 'error'))
                }}
              >
                <span aria-hidden>⬡</span>
                <span>Terraform HCL</span>
              </button>
              <button
                className="rift-dropdown-item"
                disabled={nodes.length === 0}
                onClick={() => {
                  setExportOpen(false)
                  window.dispatchEvent(
                    new CustomEvent('riftview:export-canvas', { detail: { format: 'clipboard' } })
                  )
                }}
              >
                <span aria-hidden>⎘</span>
                <span>Copy diagram</span>
              </button>
              <button
                className="rift-dropdown-item"
                disabled={nodes.length === 0}
                onClick={() => {
                  setExportOpen(false)
                  window.dispatchEvent(
                    new CustomEvent('riftview:export-canvas', { detail: { format: 'file' } })
                  )
                }}
              >
                <span aria-hidden>↓</span>
                <span>Save diagram as PNG</span>
              </button>
            </div>
          )}
        </div>

        {/* Cost pill + hover popover */}
        {nodes.length > 0 && (
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              if (hasCostPopover) setCostHover(true)
            }}
            onMouseLeave={() => setCostHover(false)}
          >
            <span
              className="pill"
              style={{
                color: 'var(--moss-500)',
                borderColor: 'oklch(0.68 0.10 145 / 0.4)',
                background: 'oklch(0.68 0.10 145 / 0.06)',
                cursor: hasCostPopover ? 'default' : undefined
              }}
            >
              {formatPrice(totalCost)}
            </span>

            {costHover && hasCostPopover && (
              <div
                className="term"
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  zIndex: 'var(--z-overlay)' as unknown as number,
                  minWidth: 240
                }}
              >
                <div className="term-head">
                  <span className="eyebrow" style={{ color: 'var(--fg-dim)' }}>
                    Top cost by node
                  </span>
                </div>
                <div style={{ padding: '6px 0' }}>
                  {top5.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          color: 'var(--fg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={n.label}
                      >
                        {n.label}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: 'var(--fg-dim)',
                          background: 'var(--ink-900)',
                          borderRadius: 2,
                          padding: '1px 5px',
                          flexShrink: 0
                        }}
                      >
                        {n.type}
                      </span>
                      <span
                        style={{
                          color: 'var(--moss-500)',
                          flexShrink: 0,
                          fontSize: 10
                        }}
                      >
                        ~${n.cost.toFixed(2)}/mo
                      </span>
                    </div>
                  ))}
                  {remainder > 0 && (
                    <div
                      style={{
                        padding: '4px 12px 2px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--fg-dim)',
                        borderTop: '1px solid var(--border)',
                        marginTop: 4
                      }}
                    >
                      …and {remainder} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={hairlineStyle} />

        <button
          className="btn btn-sm btn-ghost"
          title="Search (⌘K)"
          onClick={() => window.dispatchEvent(new CustomEvent('riftview:open-search'))}
        >
          <span aria-hidden>⌕</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>⌘K</span>
        </button>

        <button
          className="btn btn-sm btn-ghost"
          title="Settings"
          onClick={() => window.dispatchEvent(new CustomEvent('riftview:show-settings'))}
        >
          <span aria-hidden>⚙</span>
        </button>

        <button
          className="btn btn-sm btn-ghost"
          title="About RiftView"
          onClick={() => window.dispatchEvent(new CustomEvent('riftview:show-about'))}
        >
          <span aria-hidden>?</span>
        </button>

        <button
          className="btn btn-sm btn-primary"
          onClick={onScan}
          disabled={scanStatus === 'scanning'}
          style={{ opacity: scanStatus === 'scanning' ? 0.6 : 1 }}
        >
          {scanStatus === 'scanning' ? (
            <>
              <span aria-hidden>⟳</span>
              <span>Scanning…</span>
            </>
          ) : (
            <>
              <span aria-hidden>⟳</span>
              <span>Scan</span>
            </>
          )}
        </button>
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}

      {tfModules && (
        <TfModuleSelectorModal
          modules={tfModules}
          onConfirm={handleModuleConfirm}
          onCancel={handleModuleCancel}
        />
      )}
    </div>
  )
}
