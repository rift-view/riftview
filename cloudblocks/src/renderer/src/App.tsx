import { useState, useEffect, useCallback, useRef } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useScanner } from '../hooks/useScanner'
import { TitleBar } from '../components/TitleBar'
import { Sidebar } from '../components/Sidebar'
import { CloudCanvas } from '../components/canvas/CloudCanvas'
import { Inspector } from '../components/Inspector'
import { CommandDrawer } from '../components/CommandDrawer'
import { CreateModal } from '../components/modals/CreateModal'
import { Onboarding } from '../components/Onboarding'
import { ErrorBanner } from '../components/ErrorBanner'
import SettingsPanel from '../components/SettingsPanel'
import NodeContextMenu from '../components/canvas/NodeContextMenu'
import DeleteDialog from '../components/modals/DeleteDialog'
import EditModal from '../components/modals/EditModal'
import { SearchPalette } from '../components/SearchPalette'
import { buildDeleteCommands, buildQuickActionCommand } from '../utils/buildDeleteCommands'
import type { DeleteOptions } from '../utils/buildDeleteCommands'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import { useCliStore } from '../store/cli'
import type { AwsProfile, CloudNode } from '../types/cloud'
import { AboutModal } from '../components/AboutModal'
import { SettingsModal } from '../components/SettingsModal'

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }): React.JSX.Element {
  const startX = useRef<number | null>(null)

  function onMouseDown(e: React.MouseEvent): void {
    e.preventDefault()
    startX.current = e.clientX
    function onMouseMove(me: MouseEvent): void {
      if (startX.current === null) return
      const delta = me.clientX - startX.current
      startX.current = me.clientX
      onResize(delta)
    }
    function onMouseUp(): void {
      startX.current = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width:      4,
        flexShrink: 0,
        cursor:     'col-resize',
        background: 'var(--cb-border)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cb-accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cb-border)')}
    />
  )
}

export default function App(): React.JSX.Element | null {
  useIpc()
  const { triggerScan } = useScanner()
  const [profiles, setProfiles] = useState<AwsProfile[] | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const errorMessage      = useCloudStore((s) => s.errorMessage)
  const setError          = useCloudStore((s) => s.setError)
  const settings          = useCloudStore((s) => s.settings)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)
  const selectNode        = useUIStore((s) => s.selectNode)
  const showAbout         = useUIStore((s) => s.showAbout)
  const setShowAbout      = useUIStore((s) => s.setShowAbout)
  const showSettings      = useUIStore((s) => s.showSettings)
  const setShowSettings   = useUIStore((s) => s.setShowSettings)

  const [deleteTarget, setDeleteTarget] = useState<CloudNode | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ node: CloudNode; x: number; y: number } | null>(null)
  const [editTarget, setEditTarget] = useState<CloudNode | null>(null)  // placeholder for Task 13
  const [sidebarWidth, setSidebarWidth] = useState(144)
  const [inspectorWidth, setInspectorWidth] = useState(192)

  const handleSearchSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    // fitView is called on the ReactFlow instance inside CanvasInner; we trigger it via a custom event
    window.dispatchEvent(new CustomEvent('cloudblocks:fitnode', { detail: { nodeId } }))
  }, [selectNode])

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    useCloudStore.getState().loadSettings()

    window.cloudblocks.loadAnnotations().then((saved) => {
      if (Object.keys(saved).length > 0) {
        useUIStore.setState({ annotations: saved })
      }
    })

    window.cloudblocks.getThemeOverrides().then((overrides) => {
      if (Object.keys(overrides).length === 0) return
      const el = document.getElementById('cb-theme-overrides') ?? document.createElement('style')
      el.id = 'cb-theme-overrides'
      el.textContent = `:root { ${Object.entries(overrides).map(([k, v]) => `${k}: ${v}`).join('; ')} }`
      if (!el.parentElement) document.head.appendChild(el)
    })

    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    function onShowAbout(): void {
      useUIStore.getState().setShowAbout(true)
    }
    function onShowSettings(): void {
      useUIStore.getState().setShowSettings(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('cloudblocks:show-about', onShowAbout)
    window.addEventListener('cloudblocks:show-settings', onShowSettings)

    const removeUpdateListener = window.cloudblocks.onUpdateAvailable(() => {
      useUIStore.getState().showToast('Update downloaded — restart to apply', 'success')
    })

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('cloudblocks:show-about', onShowAbout)
      window.removeEventListener('cloudblocks:show-settings', onShowSettings)
      removeUpdateListener()
    }
  }, [])

  const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions): void => {
    const commands = buildDeleteCommands(node, opts)
    setCommandPreview(commands.map(argv => 'aws ' + argv.join(' ')))
    setPendingCommand(commands)
    setDeleteTarget(null)
  }

  const handleDeleteRequest = (node: CloudNode): void => {
    if (settings.deleteConfirmStyle === 'command-drawer') {
      handleDeleteConfirm(node, {})
    } else {
      setDeleteTarget(node)
    }
  }

  const handleQuickAction = (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }): void => {
    if (action === 'invalidate') {
      window.cloudblocks.invalidateCloudFront(node.id, meta?.path ?? '/*')
      return
    }
    const cmds = buildQuickActionCommand(node, action)
    setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
    setPendingCommand(cmds)
  }

  const handleNodeContextMenu = (node: CloudNode, x: number, y: number): void => {
    setNodeMenu({ node, x, y })
  }

  if (profiles === null) return <div style={{ background: 'var(--cb-bg-app)', height: '100vh' }} />
  if (profiles.length === 0) return <Onboarding />

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: 'var(--cb-bg-app)' }}>
      <TitleBar onSettingsOpen={() => setSettingsOpen(true)} />
      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setError(null)} />}
      <div className="flex flex-1 overflow-hidden">
        <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Sidebar />
        </div>
        <ResizeHandle onResize={(delta) => setSidebarWidth((w) => Math.max(80, Math.min(320, w + delta)))} />
        <CloudCanvas onScan={triggerScan} onNodeContextMenu={handleNodeContextMenu} />
        <ResizeHandle onResize={(delta) => setInspectorWidth((w) => Math.max(140, Math.min(400, w - delta)))} />
        <div style={{ width: inspectorWidth, flexShrink: 0, overflow: 'hidden' }}>
          <Inspector onDelete={handleDeleteRequest} onEdit={node => setEditTarget(node)} onQuickAction={handleQuickAction} />
        </div>
      </div>
      <CommandDrawer />
      <CreateModal />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
      {nodeMenu && (
        <NodeContextMenu
          node={nodeMenu.node}
          x={nodeMenu.x}
          y={nodeMenu.y}
          onEdit={node => { setNodeMenu(null); setEditTarget(node) }}
          onDelete={node => { setNodeMenu(null); handleDeleteRequest(node) }}
          onStop={node => {
            setNodeMenu(null)
            const cmds = buildQuickActionCommand(node, 'stop')
            setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
            setPendingCommand(cmds)
          }}
          onStart={node => {
            setNodeMenu(null)
            const cmds = buildQuickActionCommand(node, 'start')
            setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
            setPendingCommand(cmds)
          }}
          onClose={() => setNodeMenu(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          node={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={opts => handleDeleteConfirm(deleteTarget, opts)}
        />
      )}
      <EditModal node={editTarget} onClose={() => setEditTarget(null)} />
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
