# UI Bar Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign TitleBar and CloudCanvas toolbar to establish clear information hierarchy: TitleBar owns scan/I/O, canvas toolbar owns viewport only, new DriftModeStrip owns drift controls, Sidebar gets collapsible service categories.

**Architecture:** `onScan` prop moves from CloudCanvas to TitleBar; DriftModeStrip is a new layout-flow component (not absolute-positioned) replacing DriftNotificationBanner and the two conditional toolbar buttons; Sidebar replaces the flat SERVICES list with a 12-category accordion; CanvasContextMenu gets a Canvas section with Note + Tidy.

**Tech Stack:** React 19, Zustand 5, TypeScript, Tailwind CSS 4, Vitest + RTL

---

## File Map

| File | Change |
|---|---|
| `src/renderer/components/TitleBar.tsx` | Add `onScan` prop + Scan/cost/timestamp; replace TF Import+Templates with Import ▾ dropdown; remove Tidy |
| `src/renderer/components/canvas/CloudCanvas.tsx` | Strip toolbar to viewport-only; restructure layout for DriftModeStrip; remove `onScan` from Props |
| `src/renderer/components/canvas/DriftModeStrip.tsx` | **NEW** — persistent drift mode strip, replaces DriftNotificationBanner |
| `src/renderer/components/canvas/CanvasContextMenu.tsx` | Add Canvas section: Note + Tidy |
| `src/renderer/components/Sidebar.tsx` | Replace flat list with 12 collapsible categories |
| `src/renderer/src/App.tsx` | Move `onScan={triggerScan}` from CloudCanvas to TitleBar |

---

## Task 1: DriftModeStrip component

**Files:**
- Create: `src/renderer/components/canvas/DriftModeStrip.tsx`
- Test: `tests/renderer/components/DriftModeStrip.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/renderer/components/DriftModeStrip.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriftModeStrip } from '../../../src/renderer/components/canvas/DriftModeStrip'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { CloudNode } from '../../../src/renderer/types/cloud'

const baseNode = (id: string, driftStatus: CloudNode['driftStatus']): CloudNode =>
  ({ id, type: 'ec2', label: id, region: 'us-east-1', metadata: {}, driftStatus } as CloudNode)

beforeEach(() => {
  window.cloudblocks = {
    clearTfState: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as typeof window.cloudblocks
  useCloudStore.setState({
    nodes: [
      baseNode('n1', 'matched'),
      baseNode('n2', 'unmanaged'),
    ],
    importedNodes: [
      baseNode('i1', 'matched'),
      baseNode('i2', 'missing'),
    ],
  })
  useUIStore.setState({ driftFilterActive: false })
})

describe('DriftModeStrip', () => {
  it('shows matched, unmanaged, missing counts', () => {
    render(<DriftModeStrip />)
    expect(screen.getByText(/1 matched/i)).toBeTruthy()
    expect(screen.getByText(/1 unmanaged/i)).toBeTruthy()
    expect(screen.getByText(/1 missing/i)).toBeTruthy()
  })

  it('drift only button calls toggleDriftFilter', () => {
    const toggle = vi.fn()
    useUIStore.setState({ toggleDriftFilter: toggle } as unknown as Parameters<typeof useUIStore.setState>[0])
    render(<DriftModeStrip />)
    fireEvent.click(screen.getByText(/drift only/i))
    expect(toggle).toHaveBeenCalled()
  })

  it('clear button calls clearTfState IPC and clearImportedNodes', async () => {
    render(<DriftModeStrip />)
    fireEvent.click(screen.getByText(/clear/i))
    await vi.waitFor(() => expect(window.cloudblocks.clearTfState).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- --reporter=verbose tests/renderer/components/DriftModeStrip.test.tsx 2>&1 | tail -20
```

- [ ] **Step 3: Implement DriftModeStrip**

```typescript
// src/renderer/components/canvas/DriftModeStrip.tsx
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

export function DriftModeStrip(): React.JSX.Element | null {
  const importedNodes      = useCloudStore((s) => s.importedNodes)
  const nodes              = useCloudStore((s) => s.nodes)
  const driftFilterActive  = useUIStore((s) => s.driftFilterActive)
  const toggleDriftFilter  = useUIStore((s) => s.toggleDriftFilter)

  if (importedNodes.length === 0) return null

  const driftMatched   = nodes.filter((n) => n.driftStatus === 'matched').length
  const driftUnmanaged = nodes.filter((n) => n.driftStatus === 'unmanaged').length
  const driftMissing   = importedNodes.filter((n) => n.driftStatus === 'missing').length

  async function handleClear(): Promise<void> {
    try {
      await window.cloudblocks.clearTfState()
      useCloudStore.getState().clearImportedNodes()
    } catch {
      useUIStore.getState().showToast('Failed to clear Terraform import', 'error')
    }
  }

  const btn: React.CSSProperties = {
    fontFamily: 'monospace', fontSize: 9, borderRadius: 3,
    padding: '1px 8px', cursor: 'pointer', background: 'transparent',
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 12px', height: 28, flexShrink: 0,
      background: 'rgba(239,68,68,0.06)',
      borderBottom: '1px solid rgba(239,68,68,0.2)',
      fontFamily: 'monospace',
    }}>
      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 'bold', letterSpacing: '0.05em' }}>
        ⊘ DRIFT MODE
      </span>
      <span style={{ fontSize: 10, color: '#22c55e' }}>✓ {driftMatched} matched</span>
      <span style={{ fontSize: 10, color: '#f59e0b' }}>! {driftUnmanaged} unmanaged</span>
      <span style={{ fontSize: 10, color: '#ef4444' }}>✕ {driftMissing} missing</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          onClick={toggleDriftFilter}
          title={driftFilterActive ? 'Show all nodes' : 'Show only drifted nodes'}
          style={{ ...btn, border: `1px solid ${driftFilterActive ? '#ef4444' : 'var(--cb-border)'}`, color: driftFilterActive ? '#ef4444' : 'var(--cb-text-muted)' }}
        >
          ⊘ Drift only
        </button>
        <button
          onClick={() => { void handleClear() }}
          title="Clear imported Terraform state"
          style={{ ...btn, border: '1px solid var(--cb-border)', color: '#f59e0b' }}
        >
          Clear TF ×
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test -- tests/renderer/components/DriftModeStrip.test.tsx 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/canvas/DriftModeStrip.tsx tests/renderer/components/DriftModeStrip.test.tsx && git commit -m "feat: add DriftModeStrip — persistent drift controls strip"
```

---

## Task 2: TitleBar restructure

**Files:**
- Modify: `src/renderer/components/TitleBar.tsx`

The TitleBar gains: `onScan` prop, Scan button + "scanned N ago" timestamp + cost pill after the connection status separator, Import ▾ dropdown (Terraform → calls existing `handleImportTfState`; Templates → dispatches `cloudblocks:show-templates`; SAM → shows toast "coming soon"), `relativeTime` helper (moved from CloudCanvas), `forceUpdate` timer.

Removes: Tidy button, standalone TF Import button, standalone Templates button, drift summary pill.

- [ ] **Step 1: Replace TitleBar.tsx**

```typescript
// src/renderer/components/TitleBar.tsx
import { useEffect, useRef, useState } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import type { AwsProfile } from '../types/cloud'
import TemplatesModal from './TemplatesModal'
import { getMonthlyEstimate, formatPrice } from '../utils/pricing'

const LOCAL_PROFILE_NAME    = 'local'
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

  const profile      = useCloudStore((s) => s.profile)
  const setProfile   = useCloudStore((s) => s.setProfile)
  const nodes        = useCloudStore((s) => s.nodes)
  const scanStatus   = useCloudStore((s) => s.scanStatus)
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
      setProfile(newProfile); setEndpointInput(LOCAL_ENDPOINT_DEFAULT); setConnStatus('unknown')
      window.cloudblocks.selectProfile(newProfile)
    } else {
      const newProfile: AwsProfile = { name }
      setProfile(newProfile); setEndpointInput(''); setConnStatus('unknown')
      window.cloudblocks.selectProfile(newProfile)
    }
  }

  const handleEndpointSubmit = (): void => {
    const trimmed = endpointInput.trim()
    if (!trimmed) return
    const newProfile: AwsProfile = { name: profile.name, endpoint: trimmed }
    setProfile(newProfile); setConnStatus('unknown')
    window.cloudblocks.selectProfile(newProfile)
  }

  async function handleImportTfState(): Promise<void> {
    setImportOpen(false)
    try {
      const result = await window.cloudblocks.importTfState()
      if (result.error) { useUIStore.getState().showToast(result.error, 'error'); return }
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

  const btnBase: React.CSSProperties = { fontFamily: 'monospace', fontSize: 10, borderRadius: 4, padding: '2px 8px', cursor: 'pointer', background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }
  const dropdownMenu: React.CSSProperties = { position: 'absolute', top: '100%', marginTop: 4, zIndex: 200, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border-strong)', borderRadius: 4, overflow: 'hidden', minWidth: 150 }
  const dropdownItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid var(--cb-border)', padding: '6px 12px', fontFamily: 'monospace', fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }

  return (
    <div
      className="flex items-center gap-2 px-3 h-9 flex-shrink-0"
      style={{ background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)' }}
    >
      {/* Traffic lights */}
      <div className="flex gap-1.5 mr-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
      </div>

      <span className="text-[11px] font-bold tracking-widest font-mono" style={{ color: 'var(--cb-accent)' }}>
        CLOUDBLOCKS
      </span>

      <div className="flex-1" />

      {/* Profile + endpoint + connection */}
      <select
        value={profile.name}
        onChange={(e) => handleProfileChange(e.target.value)}
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)' }}
      >
        {profiles.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        <option disabled>──────────</option>
        <option value={LOCAL_PROFILE_NAME}>⬡ Local</option>
      </select>

      {showEndpointInput && (
        <input
          type="text" value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleEndpointSubmit() }}
          onBlur={handleEndpointSubmit}
          placeholder={LOCAL_ENDPOINT_DEFAULT}
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{ background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)', width: 160 }}
        />
      )}

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
        <span style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace', whiteSpace: 'nowrap', padding: '1px 6px', borderRadius: 3, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}>
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
              <span>⬡</span><span style={{ flex: 1 }}>Terraform</span><span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>.tfstate</span>
            </button>
            <button style={dropdownItem} onClick={() => { setImportOpen(false); window.dispatchEvent(new CustomEvent('cloudblocks:show-templates')) }}>
              <span>⊞</span><span style={{ flex: 1 }}>Templates</span>
            </button>
            <button style={{ ...dropdownItem, borderBottom: 'none' }} onClick={() => { setImportOpen(false); useUIStore.getState().showToast('SAM import coming soon', 'error') }}>
              <span>⬡</span><span style={{ flex: 1 }}>SAM</span><span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>template.yaml</span>
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
              style={{ ...dropdownItem, color: nodes.length === 0 ? 'var(--cb-text-muted)' : 'var(--cb-text-secondary)', cursor: nodes.length === 0 ? 'not-allowed' : 'pointer' }}
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

      <button onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-settings'))} style={btnBase} title="Settings">⚙</button>
      <button onClick={() => window.dispatchEvent(new CustomEvent('cloudblocks:show-about'))} style={btnBase} title="About">?</button>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | grep -E "error TS|TitleBar" | head -20
```

Expected: errors about `onScan` not yet passed from App.tsx (fixed in Task 4) and CloudCanvas not yet updated (fixed in Task 3).

- [ ] **Step 3: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/TitleBar.tsx && git commit -m "feat: titlebar — scan/cost/timestamp + Import dropdown (Terraform/Templates/SAM)"
```

---

## Task 3: CloudCanvas toolbar strip + layout restructure

**Files:**
- Modify: `src/renderer/components/canvas/CloudCanvas.tsx`

Remove from CloudCanvas: `onScan` prop, scan button, scan metadata, cost, Note button, Drift only toggle, Clear TF button, `DriftNotificationBanner`, `handleClearImport`, `driftFilterActive`/`toggleDriftFilter` store reads, `getMonthlyEstimate`/`formatPrice` imports, `totalCost` computation.

Add: `DriftModeStrip` in layout flow. Restructure outer div to `flex flex-col` to accommodate the strip.

The `cloudblocks:add-sticky-note` event listener and its handler **stay** in CloudCanvas (keyboard shortcut still needs it).

- [ ] **Step 1: Rewrite CloudCanvas.tsx**

```typescript
// src/renderer/components/canvas/CloudCanvas.tsx
import { useState, useEffect } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'
import type { StickyNote } from '../../store/ui'
import { TopologyView } from './TopologyView'
import { GraphView } from './GraphView'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasToast } from '../CanvasToast'
import { EmptyCanvasState } from './EmptyCanvasState'
import { SaveViewModal } from './SaveViewModal'
import { ScanErrorStrip } from './ScanErrorStrip'
import { DriftModeStrip } from './DriftModeStrip'
import { BulkActionToolbar } from './BulkActionToolbar'
import type { CloudNode } from '../../types/cloud'

interface Props {
  onNodeContextMenu: (node: CloudNode, x: number, y: number) => void
}

function CanvasInner({ onNodeContextMenu }: Props): React.JSX.Element {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const view            = useUIStore((s) => s.view)
  const setView         = useUIStore((s) => s.setView)
  const profile         = useCloudStore((s) => s.profile)
  const savedViews      = useUIStore((s) => s.savedViews)
  const activeViewSlot  = useUIStore((s) => s.activeViewSlot)
  const saveView        = useUIStore((s) => s.saveView)
  const loadView        = useUIStore((s) => s.loadView)
  const showIntegrations   = useUIStore((s) => s.showIntegrations)
  const toggleIntegrations = useUIStore((s) => s.toggleIntegrations)
  const snapToGrid         = useUIStore((s) => s.snapToGrid)
  const toggleSnapToGrid   = useUIStore((s) => s.toggleSnapToGrid)
  const addStickyNote  = useUIStore((s) => s.addStickyNote)
  const setAnnotation  = useUIStore((s) => s.setAnnotation)

  const [modalSlot, setModalSlot]     = useState<number | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const profileKey = profile.name + '|' + (profile.endpoint ?? '')

  useEffect(() => {
    function onFitNode(e: Event): void {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 })
    }
    window.addEventListener('cloudblocks:fitnode', onFitNode)
    return () => window.removeEventListener('cloudblocks:fitnode', onFitNode)
  }, [fitView])

  useEffect(() => {
    const handler = (): void => { void fitView({ duration: 300 }) }
    window.addEventListener('cloudblocks:fitview', handler)
    return () => window.removeEventListener('cloudblocks:fitview', handler)
  }, [fitView])

  useEffect(() => {
    function onAddStickyNote(): void {
      const id   = `sn-${Date.now()}`
      const note: StickyNote = { id, content: '', position: { x: 120, y: 120 } }
      addStickyNote(note)
      setAnnotation(`sticky:${id}`, '')
      void window.cloudblocks.saveAnnotations({ ...useUIStore.getState().annotations, [`sticky:${id}`]: '' })
    }
    window.addEventListener('cloudblocks:add-sticky-note', onAddStickyNote)
    return () => window.removeEventListener('cloudblocks:add-sticky-note', onAddStickyNote)
  }, [addStickyNote, setAnnotation])

  const btnBase = { fontFamily: 'monospace', fontSize: '9px', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleSlotClick(slot: number): void {
    const saved = savedViews[slot]
    if (saved === null) {
      setModalSlot(slot)
    } else if (slot === activeViewSlot) {
      setModalSlot(slot)
    } else {
      loadView(slot, view, () => fitView({ duration: 300 }))
    }
  }

  function handleModalSave(name: string): void {
    if (modalSlot === null) return
    saveView(modalSlot, name, view)
    setModalSlot(null)
  }

  const activeViewName = activeViewSlot !== null ? (savedViews[activeViewSlot]?.name ?? null) : null

  return (
    <div className="flex flex-col flex-1 h-full">
      <DriftModeStrip />

      <div className="relative flex-1" onContextMenu={handleContextMenu}>
        {/* Viewport toolbar */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md"
             style={{ background: 'var(--cb-minimap-bg)', border: '1px solid var(--cb-border-strong)' }}>

          <button onClick={() => fitView({ duration: 300 })} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>⊞ Fit</button>
          <button onClick={() => zoomIn()}  style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>+</button>
          <button onClick={() => zoomOut()} style={{ ...btnBase, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', color: 'var(--cb-text-secondary)' }}>−</button>

          <div className="w-px h-3.5 bg-gray-700" />

          <button
            onClick={toggleIntegrations}
            title={showIntegrations ? 'Hide integration edges' : 'Show integration edges'}
            style={{ ...btnBase, background: showIntegrations ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${showIntegrations ? '#64b5f6' : 'var(--cb-border)'}`, color: showIntegrations ? '#64b5f6' : '#666' }}
          >⇢ Integrations</button>

          <button
            onClick={toggleSnapToGrid}
            title={snapToGrid ? 'Disable snap to grid' : 'Enable snap to grid'}
            style={{ ...btnBase, background: snapToGrid ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${snapToGrid ? '#64b5f6' : 'var(--cb-border)'}`, color: snapToGrid ? '#64b5f6' : '#666' }}
          >▦ Grid</button>

          <div className="w-px h-3.5 bg-gray-700" />

          {(['topology', 'graph'] as const).map((v) => (
            <button
              key={v} onClick={() => setView(v)}
              style={{ ...btnBase, background: view === v ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${view === v ? '#64b5f6' : 'var(--cb-border)'}`, color: view === v ? '#64b5f6' : '#666' }}
            >
              {v === 'topology' ? '⊞ Topology' : '◈ Graph'}
            </button>
          ))}

          <div className="w-px h-3.5 bg-gray-700" />

          {([0, 1, 2, 3] as const).map((slot) => {
            const saved    = savedViews[slot]
            const isActive = slot === activeViewSlot
            return (
              <button
                key={slot} onClick={() => handleSlotClick(slot)}
                title={saved?.name ?? `Empty slot ${slot + 1}`}
                style={{ ...btnBase, background: isActive ? 'var(--cb-bg-elevated)' : 'transparent', border: `1px solid ${saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-border-strong)') : 'var(--cb-border)'}`, color: saved ? (isActive ? 'var(--cb-accent)' : 'var(--cb-text-secondary)') : '#444', minWidth: 20 }}
              >
                {slot + 1}
              </button>
            )
          })}

          {activeViewName && (
            <span style={{ fontSize: 10, color: 'var(--cb-text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeViewName}
            </span>
          )}
        </div>

        <ScanErrorStrip />
        <BulkActionToolbar />

        {view === 'topology'
          ? <TopologyView onNodeContextMenu={onNodeContextMenu} />
          : <GraphView onNodeContextMenu={onNodeContextMenu} />
        }

        {/* Local endpoint badge */}
        {profile.endpoint && (
          <div style={{ position: 'absolute', top: 52, left: 8, zIndex: 10, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', color: '#f59e0b', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            LOCAL · {profile.endpoint}
          </div>
        )}

        <div key={profileKey} style={{ position: 'absolute', inset: 0, background: '#000', pointerEvents: 'none', zIndex: 200, animation: 'crt-on 0.7s ease-out forwards' }} />

        {contextMenu && (
          <CanvasContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} />
        )}

        <EmptyCanvasState />
        <CanvasToast />

        {modalSlot !== null && (
          <SaveViewModal
            slot={modalSlot}
            initialName={savedViews[modalSlot]?.name ?? ''}
            onSave={handleModalSave}
            onCancel={() => setModalSlot(null)}
          />
        )}
      </div>
    </div>
  )
}

export function CloudCanvas(props: Props): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | grep "error TS" | head -20
```

Expected: errors only about TitleBar missing `onScan` prop in App.tsx (fixed in Task 4).

- [ ] **Step 3: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/canvas/CloudCanvas.tsx && git commit -m "feat: canvas toolbar — viewport-only; DriftModeStrip in layout"
```

---

## Task 4: App.tsx — wire onScan to TitleBar

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Update TitleBar and CloudCanvas props**

In `App.tsx`, change:
```tsx
// old
<TitleBar />
...
<CloudCanvas onScan={triggerScan} onNodeContextMenu={handleNodeContextMenu} />
```
to:
```tsx
// new
<TitleBar onScan={triggerScan} />
...
<CloudCanvas onNodeContextMenu={handleNodeContextMenu} />
```

- [ ] **Step 2: Run typecheck — expect clean**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/src/App.tsx && git commit -m "fix: pass onScan to TitleBar; remove from CloudCanvas"
```

---

## Task 5: CanvasContextMenu — add Canvas section

**Files:**
- Modify: `src/renderer/components/canvas/CanvasContextMenu.tsx`

Add a "Canvas" section at the top of the context menu (before "Create Resource") with:
- ✎ Add Note — dispatches `cloudblocks:add-sticky-note`
- ⊞ Tidy Layout — calls `computeTidyLayout` + `applyTidyLayout` + dispatches `cloudblocks:fitview`

- [ ] **Step 1: Rewrite CanvasContextMenu.tsx**

```typescript
// src/renderer/components/canvas/CanvasContextMenu.tsx
import { useState } from 'react'
import { useUIStore } from '../../store/ui'
import { useCloudStore } from '../../store/cloud'
import { computeTidyLayout } from '../../utils/tidyLayout'

interface Props {
  x: number
  y: number
  onClose: () => void
}

const CREATABLE = [
  { resource: 'vpc',        label: 'New VPC' },
  { resource: 'ec2',        label: 'New EC2 Instance' },
  { resource: 'sg',         label: 'New Security Group' },
  { resource: 's3',         label: 'New S3 Bucket' },
  { resource: 'rds',        label: 'New RDS Instance' },
  { resource: 'lambda',     label: 'New Lambda Function' },
  { resource: 'alb',        label: 'New ALB' },
  { resource: 'acm',        label: 'New ACM Certificate' },
  { resource: 'cloudfront', label: 'New CloudFront Distribution' },
  { resource: 'apigw',      label: 'New API Gateway' },
] as const

export function CanvasContextMenu({ x, y, onClose }: Props): React.JSX.Element {
  const setActiveCreate = useUIStore((s) => s.setActiveCreate)
  const view            = useUIStore((s) => s.view)
  const applyTidyLayout = useUIStore((s) => s.applyTidyLayout)
  const nodes           = useCloudStore((s) => s.nodes)
  const [pendingResource, setPendingResource] = useState<string | null>(null)

  const menuStyle: React.CSSProperties = {
    position: 'fixed', top: y, left: x,
    background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-accent)', borderRadius: 4,
    fontFamily: 'monospace', fontSize: 10, zIndex: 1000, minWidth: 165,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  }
  function hoverOn(e: React.MouseEvent<HTMLDivElement>): void {
    (e.currentTarget as HTMLDivElement).style.background = 'var(--cb-bg-elevated)'
    ;(e.currentTarget as HTMLDivElement).style.color = 'var(--cb-accent)'
  }
  function hoverOff(e: React.MouseEvent<HTMLDivElement>): void {
    (e.currentTarget as HTMLDivElement).style.background = 'transparent'
    ;(e.currentTarget as HTMLDivElement).style.color = 'var(--cb-text-secondary)'
  }
  const itemStyle: React.CSSProperties = { padding: '5px 10px', color: 'var(--cb-text-secondary)', cursor: 'pointer' }
  const sectionLabel: React.CSSProperties = { padding: '4px 10px 2px', color: 'var(--cb-text-muted)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }

  function handleTidy(): void {
    if (nodes.length === 0) return
    const viewKey = view === 'topology' ? 'topology' : 'graph'
    const positions = computeTidyLayout(nodes, viewKey)
    applyTidyLayout(viewKey, positions)
    window.dispatchEvent(new CustomEvent('cloudblocks:fitview'))
    onClose()
  }

  function selectView(v: 'topology' | 'graph'): void {
    if (!pendingResource) return
    setActiveCreate({ resource: pendingResource, view: v })
    onClose()
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
      />
      <div style={menuStyle}>
        {!pendingResource ? (
          <>
            {/* Canvas section */}
            <div style={sectionLabel}>Canvas</div>
            <div style={itemStyle} onClick={() => { window.dispatchEvent(new CustomEvent('cloudblocks:add-sticky-note')); onClose() }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              ✎ &nbsp;Add Note
            </div>
            <div style={{ ...itemStyle, borderBottom: '1px solid var(--cb-border-strong)' }} onClick={handleTidy} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              ⊞ &nbsp;Tidy Layout
            </div>

            {/* Create section */}
            <div style={sectionLabel}>Create Resource</div>
            {CREATABLE.map((item) => (
              <div key={item.resource} style={itemStyle} onClick={() => setPendingResource(item.resource)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                + {item.label}
              </div>
            ))}
          </>
        ) : (
          <>
            <div style={sectionLabel}>Add to View</div>
            {(['topology', 'graph'] as const).map((v) => (
              <div key={v} style={itemStyle} onClick={() => selectView(v)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                {v === 'topology' ? '⊞' : '◈'} {v.charAt(0).toUpperCase() + v.slice(1)}
              </div>
            ))}
            <div style={{ ...itemStyle, borderTop: '1px solid var(--cb-border-strong)', color: 'var(--cb-text-muted)' }} onClick={() => setPendingResource(null)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              ← Back
            </div>
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Run typecheck + tests**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | grep "error TS" | head -10 && npm test 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/canvas/CanvasContextMenu.tsx && git commit -m "feat: context menu — Canvas section with Note + Tidy"
```

---

## Task 6: Sidebar — collapsible categories

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`

Replace the flat SERVICES list with a 12-category accordion. Each category header shows the total count of all nodes in that category. Click to expand/collapse. All categories start expanded. SSM Parameters (special sub-grouping) stays inside the Management category. The Views section and plugin services section stay at the bottom unchanged.

- [ ] **Step 1: Rewrite Sidebar.tsx**

Replace the `SERVICES` array and the flat render loop with a `CATEGORIES` array and category accordion. Key structural changes:

```typescript
// Add at the top (after existing imports, replace SERVICES with CATEGORIES):

type ServiceDef = { type: NodeType; label: string; hasCreate: boolean; resource?: string }

const CATEGORIES: { label: string; services: ServiceDef[] }[] = [
  { label: 'Compute', services: [
    { type: 'ec2',    label: 'EC2',    hasCreate: true },
    { type: 'lambda', label: 'Lambda', hasCreate: true },
  ]},
  { label: 'Networking', services: [
    { type: 'vpc',            label: 'VPC',            hasCreate: true },
    { type: 'subnet',         label: 'Subnet',         hasCreate: false },
    { type: 'security-group', label: 'Security Group', hasCreate: true, resource: 'sg' },
    { type: 'igw',            label: 'IGW',            hasCreate: false },
    { type: 'nat-gateway',    label: 'NAT Gateway',    hasCreate: false },
  ]},
  { label: 'Storage', services: [
    { type: 's3', label: 'S3', hasCreate: true },
  ]},
  { label: 'Database', services: [
    { type: 'rds',    label: 'RDS',      hasCreate: true },
    { type: 'dynamo', label: 'DynamoDB', hasCreate: true },
  ]},
  { label: 'Messaging', services: [
    { type: 'sqs',             label: 'SQS',         hasCreate: true },
    { type: 'sns',             label: 'SNS',         hasCreate: true },
    { type: 'eventbridge-bus', label: 'EventBridge', hasCreate: true },
  ]},
  { label: 'Edge & API', services: [
    { type: 'cloudfront',  label: 'CloudFront',   hasCreate: true },
    { type: 'apigw',       label: 'API Gateway',  hasCreate: true },
    { type: 'apigw-route', label: 'API Route',    hasCreate: false },
  ]},
  { label: 'Security', services: [
    { type: 'acm',    label: 'ACM',             hasCreate: true },
    { type: 'secret', label: 'Secrets Manager', hasCreate: true },
  ]},
  { label: 'Management', services: [] },  // SSM only — rendered inline below via ssmGroups
  { label: 'Orchestration', services: [
    { type: 'sfn', label: 'Step Functions', hasCreate: true },
  ]},
  { label: 'Containers', services: [
    { type: 'ecr-repo', label: 'ECR', hasCreate: true, resource: 'ecr' },
  ]},
  { label: 'Load Balancing', services: [
    { type: 'alb', label: 'ALB', hasCreate: true },
  ]},
  { label: 'DNS', services: [
    { type: 'r53-zone', label: 'Route 53', hasCreate: false },
  ]},
]
```

Replace the `Sidebar` function body — inside the `return`, replace the flat SERVICES render with:

```tsx
// Replace the single SERVICES.map block and the SSM section with:

{CATEGORIES.map((cat) => {
  const isManagement = cat.label === 'Management'
  // Total count for this category (services + ssm if Management)
  const catCount = cat.services.reduce((sum, s) => sum + (counts[s.type] ?? 0), 0)
    + (isManagement ? nodes.filter((n) => n.type === 'ssm-param').length : 0)
  const isExpanded = expandedCategories.has(cat.label)

  return (
    <div key={cat.label}>
      {/* Category header */}
      <div
        onClick={() => toggleCategory(cat.label)}
        className="flex items-center justify-between mx-1.5 mb-0.5 px-2 py-1 rounded cursor-pointer text-[9px] font-mono uppercase tracking-widest"
        style={{ color: 'var(--cb-text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cb-bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span>{isExpanded ? '⊟' : '⊞'} {cat.label}</span>
        {catCount > 0 && <span style={badgeStyle}>{catCount}</span>}
      </div>

      {/* Category items */}
      {isExpanded && (
        <>
          {cat.services.map((s) => {
            const count = counts[s.type] ?? 0
            const isActive = activeSidebarType === s.type
            const errTooltip = errorsByType.get(s.type)
            const activeStyle: React.CSSProperties = { ...serviceRowStyle, border: '1px solid var(--cb-accent)', color: 'var(--cb-accent)', background: 'var(--cb-bg-elevated)', cursor: 'pointer' }
            return (
              <div
                key={s.type}
                draggable={s.hasCreate}
                onDragStart={s.hasCreate ? (e) => e.dataTransfer.setData('text/plain', s.resource ?? s.type) : undefined}
                onClick={() => { if (isActive) { removeFilter('sidebar-type') } else setFilterTarget(s.type) }}
                className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono"
                style={{ ...(isActive ? activeStyle : serviceRowStyle), cursor: s.hasCreate ? 'grab' : 'default', paddingLeft: 20 }}
              >
                <span>
                  ⬡ {s.label}
                  {errTooltip && <span title={errTooltip} style={{ color: '#f59e0b', fontSize: 10, marginLeft: 4 }}>⚠</span>}
                </span>
                {count > 0 && <span style={badgeStyle}>{count}</span>}
              </div>
            )
          })}

          {/* Management: SSM sub-groups rendered inline */}
          {isManagement && (ssmGroups.length > 0 || ssmErrTooltip) && (
            <>
              {ssmErrTooltip && (
                <div className="px-2.5 mx-1.5 text-[9px] font-mono" style={{ color: '#f59e0b' }}>
                  <span title={ssmErrTooltip}>⚠ SSM error</span>
                </div>
              )}
              {ssmGroups.map(({ prefix, nodes: groupNodes }) => {
                if (groupNodes.length === 1) {
                  const node = groupNodes[0]
                  return (
                    <div key={node.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                      className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                      style={{ ...serviceRowStyle, paddingLeft: 20 }} title={node.label}>
                      <span className="truncate">⬡ {node.label}</span>
                    </div>
                  )
                }
                const isGroupExpanded = expandedSsmGroups.has(prefix)
                return (
                  <div key={prefix}>
                    <div onClick={() => toggleSsmGroup(prefix)}
                      className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-pointer"
                      style={{ color: 'var(--cb-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 20 }}>
                      <span className="truncate">{isGroupExpanded ? '⊟' : '⊞'} {prefix}/</span>
                      <span style={badgeStyle}>{groupNodes.length}</span>
                    </div>
                    {isGroupExpanded && groupNodes.slice().sort((a, b) => a.label.localeCompare(b.label)).map((node) => (
                      <div key={node.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', 'ssm-param')}
                        className="mx-1.5 mb-0.5 px-2.5 py-1 rounded text-[9px] font-mono cursor-grab"
                        style={{ ...serviceRowStyle, paddingLeft: 28 }} title={node.label}>
                        <span className="truncate">⬡ {node.label}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
})}
```

Add `expandedCategories` and `toggleCategory` as local state (all categories start open):

```typescript
const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
  () => new Set(CATEGORIES.map((c) => c.label))
)
function toggleCategory(label: string): void {
  setExpandedCategories((prev) => {
    const next = new Set(prev)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    return next
  })
}
```

Remove the old `SERVICES` const and `TYPE_LABELS` const. Remove the `ssm-param` check from `errorsByType` (it still computes correctly since `SCAN_KEY_TO_TYPE` maps include ssm-param; the `ssmErrTooltip` variable is now used inside the Management category block). Keep `ssmErrTooltip`.

Add this helper above the `Sidebar` function to replace `TYPE_LABELS` in `onConfirm`:

```typescript
function getTypeLabel(type: NodeType): string {
  for (const cat of CATEGORIES) {
    const svc = cat.services.find((s) => s.type === type)
    if (svc) return svc.label
  }
  return type.toUpperCase()
}
```

In the `onConfirm` callback of `SidebarFilterDialog`, replace:
```typescript
const label = TYPE_LABELS[filterTarget] ?? filterTarget.toUpperCase()
```
with:
```typescript
const label = getTypeLabel(filterTarget)
```

- [ ] **Step 2: Run typecheck**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run typecheck 2>&1 | grep "error TS" | head -20
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm test 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && git add src/renderer/components/Sidebar.tsx && git commit -m "feat: sidebar — 12 collapsible service categories"
```

---

## Final Verification

- [ ] **Run full CI checks**

```bash
cd /Users/julius/AI/cloudblocks/cloudblocks && npm run lint && npm run typecheck && npm test 2>&1 | tail -20
```

Expected: lint clean, 0 type errors, all tests pass.
