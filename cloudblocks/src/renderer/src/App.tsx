import { useState, useEffect, useCallback } from 'react'
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

  const handleSearchSelect = useCallback((nodeId: string) => {
    selectNode(nodeId)
    // fitView is called on the ReactFlow instance inside CanvasInner; we trigger it via a custom event
    window.dispatchEvent(new CustomEvent('cloudblocks:fitnode', { detail: { nodeId } }))
  }, [selectNode])

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    useCloudStore.getState().loadSettings()

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
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('cloudblocks:show-about', onShowAbout)
      window.removeEventListener('cloudblocks:show-settings', onShowSettings)
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
        <Sidebar />
        <CloudCanvas onScan={triggerScan} onNodeContextMenu={handleNodeContextMenu} />
        <Inspector onDelete={handleDeleteRequest} onEdit={node => setEditTarget(node)} onQuickAction={handleQuickAction} />
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
