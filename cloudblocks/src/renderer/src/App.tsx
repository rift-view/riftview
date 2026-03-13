import { useState, useEffect } from 'react'
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
import { buildDeleteCommands, buildQuickActionCommand } from '../utils/buildDeleteCommands'
import type { DeleteOptions } from '../utils/buildDeleteCommands'
import { useCloudStore } from '../store/cloud'
import type { AwsProfile, CloudNode } from '../types/cloud'

export default function App(){
  useIpc()
  const { triggerScan } = useScanner()
  const [profiles, setProfiles] = useState<AwsProfile[] | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const errorMessage = useCloudStore((s) => s.errorMessage)
  const setError     = useCloudStore((s) => s.setError)
  const settings = useCloudStore((s) => s.settings)
  const setCommandPreview = useCloudStore((s) => s.setCommandPreview)
  const setPendingCommand = useCloudStore((s) => s.setPendingCommand)

  const [deleteTarget, setDeleteTarget] = useState<CloudNode | null>(null)
  const [nodeMenu, setNodeMenu] = useState<{ node: CloudNode; x: number; y: number } | null>(null)
  const [editTarget, setEditTarget] = useState<CloudNode | null>(null)  // placeholder for Task 13

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    useCloudStore.getState().loadSettings()
  }, [])

  const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions) => {
    const commands = buildDeleteCommands(node, opts)
    setCommandPreview(commands.map(argv => 'aws ' + argv.join(' ')))
    setPendingCommand(commands)
    setDeleteTarget(null)
  }

  const handleDeleteRequest = (node: CloudNode) => {
    if (settings.deleteConfirmStyle === 'command-drawer') {
      handleDeleteConfirm(node, {})
    } else {
      setDeleteTarget(node)
    }
  }

  const handleQuickAction = (node: CloudNode, action: 'stop' | 'start' | 'reboot') => {
    const cmds = buildQuickActionCommand(node, action)
    setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
    setPendingCommand(cmds)
  }

  const handleNodeContextMenu = (node: CloudNode, x: number, y: number) => {
    setNodeMenu({ node, x, y })
  }

  if (profiles === null) return <div style={{ background: '#080c14', height: '100vh' }} />
  if (profiles.length === 0) return <Onboarding />

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#080c14' }}>
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
    </div>
  )
}
