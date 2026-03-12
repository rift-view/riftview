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
import { useCloudStore } from '../store/cloud'
import type { AwsProfile } from '../types/cloud'

export default function App(): JSX.Element {
  useIpc()
  const { triggerScan } = useScanner()
  const [profiles, setProfiles] = useState<AwsProfile[] | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const errorMessage = useCloudStore((s) => s.errorMessage)
  const setError     = useCloudStore((s) => s.setError)

  useEffect(() => {
    window.cloudblocks.listProfiles().then(setProfiles)
    useCloudStore.getState().loadSettings()
  }, [])

  if (profiles === null) return <div style={{ background: '#080c14', height: '100vh' }} />
  if (profiles.length === 0) return <Onboarding />

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#080c14' }}>
      <TitleBar onSettingsOpen={() => setSettingsOpen(true)} />
      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setError(null)} />}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <CloudCanvas onScan={triggerScan} />
        <Inspector />
      </div>
      <CommandDrawer />
      <CreateModal />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
