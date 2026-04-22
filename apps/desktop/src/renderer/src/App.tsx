import { useState, useEffect, useCallback, useRef } from 'react'
import { useIpc } from '../hooks/useIpc'
import { useScanner } from '../hooks/useScanner'
import { Topbar } from '../components/Topbar'
import { Statusbar } from '../components/Statusbar'
import { Sidebar } from '../components/Sidebar'
import { CloudCanvas } from '../components/canvas/CloudCanvas'
import { Inspector } from '../components/Inspector'
import { CommandDrawer } from '../components/CommandDrawer'
import { CreateModal } from '../components/modals/CreateModal'
import { Onboarding } from '../components/Onboarding'
import { ErrorBanner } from '../components/ErrorBanner'
import NodeContextMenu from '../components/canvas/NodeContextMenu'
import DeleteDialog from '../components/modals/DeleteDialog'
import EditModal from '../components/modals/EditModal'
import { SearchPalette } from '../components/SearchPalette'
import { buildQuickActionCommand } from '../utils/buildDeleteCommands'
import type { DeleteOptions } from '../utils/buildDeleteCommands'
import { resolveDeleteCommands } from '../plugin/pluginCommands'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import { useCliStore } from '../store/cli'
import type { AwsProfile, CloudNode } from '@riftview/shared'
import { AboutModal } from '../components/AboutModal'
import { SettingsModal } from '../components/SettingsModal'
import { KeyboardHelp } from '../components/KeyboardHelp'
import { KeyboardHelpButton } from '../components/KeyboardHelpButton'
import { TerminalPane } from '../components/TerminalPane'
import { useKeyboardNav } from '../hooks/useKeyboardNav'
import { useDemoFixture } from '../hooks/useDemoFixture'
import { isDemoMode } from '../utils/demoMode'

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
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        background: 'var(--border)',
        transition: 'background 0.15s'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border)')}
    />
  )
}

export default function App(): React.JSX.Element | null {
  useDemoFixture() // no-op unless RIFTVIEW_DEMO_MODE=1 and store is empty
  useIpc()
  useKeyboardNav()
  const { triggerScan } = useScanner()
  const [profiles, setProfiles] = useState<AwsProfile[] | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [fixCount, setFixCount] = useState(0)
  const errorMessage = useCloudStore((s) => s.errorMessage)
  const setError = useCloudStore((s) => s.setError)
  const settings = useCloudStore((s) => s.settings)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)
  const selectNode = useUIStore((s) => s.selectNode)
  const showAbout = useUIStore((s) => s.showAbout)
  const setShowAbout = useUIStore((s) => s.setShowAbout)
  const showSettings = useUIStore((s) => s.showSettings)
  const setShowSettings = useUIStore((s) => s.setShowSettings)

  const [deleteTarget, setDeleteTarget] = useState<CloudNode | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ node: CloudNode; x: number; y: number } | null>(null)
  const [editTarget, setEditTarget] = useState<CloudNode | null>(null) // placeholder for Task 13
  const [sidebarWidth, setSidebarWidth] = useState(144)
  const [inspectorWidth, setInspectorWidth] = useState(192)

  const handleSearchSelect = useCallback(
    (nodeId: string) => {
      selectNode(nodeId)
      // fitView is called on the ReactFlow instance inside CanvasInner; we trigger it via a custom event
      window.dispatchEvent(new CustomEvent('riftview:fitnode', { detail: { nodeId } }))
    },
    [selectNode]
  )

  useEffect(() => {
    window.riftview.listProfiles().then(setProfiles)
    useCloudStore.getState().loadSettings()

    window.riftview.loadCustomEdges().then((saved) => {
      if (saved.length > 0) {
        useUIStore.setState({ customEdges: saved })
      }
    })

    window.riftview.loadAnnotations().then((saved) => {
      if (Object.keys(saved).length === 0) return
      useUIStore.setState({ annotations: saved })

      // Rebuild stickyNotes from persisted annotations (keys prefixed with "sticky:")
      const stickyNotes = Object.entries(saved)
        .filter(([k]) => k.startsWith('sticky:'))
        .map(([k, content], i) => ({
          id: k.slice('sticky:'.length),
          content,
          position: { x: 40 + i * 220, y: 40 }
        }))
      if (stickyNotes.length > 0) {
        useUIStore.setState({ stickyNotes })
      }
    })

    window.riftview.getStyleOverrides().then((overrides) => {
      if (Object.keys(overrides).length === 0) return
      const el = document.getElementById('rift-style-overrides') ?? document.createElement('style')
      el.id = 'rift-style-overrides'
      el.textContent = `:root { ${Object.entries(overrides)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')} }`
      if (!el.parentElement) document.head.appendChild(el)
    })

    function onOpenSearch(): void {
      setSearchOpen(true)
    }
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('riftview:add-sticky-note'))
      }
    }
    function onShowAbout(): void {
      useUIStore.getState().setShowAbout(true)
    }
    function onShowSettings(): void {
      useUIStore.getState().setShowSettings(true)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('riftview:open-search', onOpenSearch)
    window.addEventListener('riftview:show-about', onShowAbout)
    window.addEventListener('riftview:show-settings', onShowSettings)

    const removeUpdateListener = window.riftview.onUpdateAvailable(() => {
      useUIStore.getState().showToast('Update downloaded — restart to apply', 'success')
    })

    const removePluginMetadata = window.riftview.onPluginMetadata((meta) => {
      useUIStore.getState().setPluginNodeTypes(meta)
    })

    // E2E test hatch — only wired when the preload capability flag is set.
    // Gives Playwright @release specs direct access to a narrow store slice
    // so they don't have to mock native OS dialogs.
    if (window.__riftviewCapabilities?.isE2EMode) {
      window.__riftviewE2E = {
        setImportedNodes: (nodes) => useCloudStore.getState().setImportedNodes(nodes)
      }
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('riftview:open-search', onOpenSearch)
      window.removeEventListener('riftview:show-about', onShowAbout)
      window.removeEventListener('riftview:show-settings', onShowSettings)
      removeUpdateListener()
      removePluginMetadata()
    }
  }, [])

  const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions): void => {
    const commands = resolveDeleteCommands(node, opts as Record<string, unknown>)
    setCommandPreview(commands.map((argv) => 'aws ' + argv.join(' ')))
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

  const handleQuickAction = (
    node: CloudNode,
    action: 'stop' | 'start' | 'reboot' | 'invalidate',
    meta?: { path?: string }
  ): void => {
    if (action === 'invalidate') {
      window.riftview.invalidateCloudFront(node.id, meta?.path ?? '/*')
      return
    }
    const cmds = buildQuickActionCommand(node, action)
    setCommandPreview(cmds.map((a) => 'aws ' + a.join(' ')))
    setPendingCommand(cmds)
  }

  async function handleRemediate(node: CloudNode, commands: string[][]): Promise<{ code: number }> {
    const prevStatus = node.status
    useCloudStore.getState().patchNodeStatus(node.id, 'pending')
    const result = await window.riftview.runCli(commands)
    if (result.code === 0) {
      setFixCount((n) => n + 1)
      useUIStore.getState().showToast('Remediation complete')
      triggerScan()
    } else {
      useCloudStore.getState().patchNodeStatus(node.id, prevStatus)
      useUIStore.getState().showToast('Remediation failed', 'error')
    }
    return result
  }

  const handleNodeContextMenu = (node: CloudNode, x: number, y: number): void => {
    setNodeMenu({ node, x, y })
  }

  if (profiles === null) return <div style={{ background: 'var(--ink-1000)', height: '100vh' }} />
  if (profiles.length === 0 && !isDemoMode()) return <Onboarding />

  return (
    <div
      className="h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateRows: 'auto auto 1fr auto',
        background: 'var(--ink-1000)'
      }}
    >
      <Topbar onScan={triggerScan} fixCount={fixCount} />
      {errorMessage ? (
        <ErrorBanner message={errorMessage} onDismiss={() => setError(null)} />
      ) : null}
      <div className="flex overflow-hidden" style={{ minHeight: 0 }}>
        <div
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Sidebar />
        </div>
        <ResizeHandle
          onResize={(delta) => setSidebarWidth((w) => Math.max(80, Math.min(320, w + delta)))}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CloudCanvas onNodeContextMenu={handleNodeContextMenu} />
          <CommandDrawer />
        </div>
        <ResizeHandle
          onResize={(delta) => setInspectorWidth((w) => Math.max(140, Math.min(400, w - delta)))}
        />
        <div style={{ width: inspectorWidth, flexShrink: 0, overflow: 'hidden' }}>
          <Inspector
            onDelete={handleDeleteRequest}
            onEdit={(node) => setEditTarget(node)}
            onQuickAction={handleQuickAction}
            onRemediate={handleRemediate}
          />
        </div>
      </div>
      <Statusbar />
      <CreateModal />
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
          onEdit={(node) => {
            setNodeMenu(null)
            setEditTarget(node)
          }}
          onDelete={(node) => {
            setNodeMenu(null)
            handleDeleteRequest(node)
          }}
          onStop={(node) => {
            setNodeMenu(null)
            const cmds = buildQuickActionCommand(node, 'stop')
            setCommandPreview(cmds.map((a) => 'aws ' + a.join(' ')))
            setPendingCommand(cmds)
          }}
          onStart={(node) => {
            setNodeMenu(null)
            const cmds = buildQuickActionCommand(node, 'start')
            setCommandPreview(cmds.map((a) => 'aws ' + a.join(' ')))
            setPendingCommand(cmds)
          }}
          onClose={() => setNodeMenu(null)}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          node={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={(opts) => handleDeleteConfirm(deleteTarget, opts)}
        />
      )}
      <EditModal node={editTarget} onClose={() => setEditTarget(null)} />
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <KeyboardHelp />
      <KeyboardHelpButton />
      <TerminalPane />
    </div>
  )
}
