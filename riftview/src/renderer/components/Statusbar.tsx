import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'

export function Statusbar(): React.JSX.Element {
  const profileName = useCloudStore((s) => s.profile.name)
  const selectedRegions = useCloudStore((s) => s.selectedRegions)
  const nodes = useCloudStore((s) => s.nodes)
  const scanStatus = useCloudStore((s) => s.scanStatus)
  const view = useUIStore((s) => s.view)
  const setView = useUIStore((s) => s.setView)

  const isScanning = scanStatus === 'scanning'
  const viewLabel = view === 'topology' ? 'Topology' : 'Graph'

  return (
    <footer className="rift-statusbar">
      <div className="cluster">
        <span className="statusbar-pair">
          <span className="k">PROFILE</span>
          <span aria-hidden>·</span>
          <span className="v">{profileName}</span>
        </span>
        <span className="statusbar-pair">
          <span className="k">REGION</span>
          <span aria-hidden>·</span>
          <span className="v">{selectedRegions.join(', ')}</span>
        </span>
        <span className={isScanning ? 'statusbar-pair -scanning' : 'statusbar-pair'}>
          <span
            className="dot"
            style={{
              backgroundColor: isScanning ? 'var(--ember-500)' : 'var(--moss-500)',
              boxShadow: isScanning ? '0 0 5px var(--ember-500)' : '0 0 5px var(--moss-500)',
              animation: isScanning ? 'rift-pulse 1.2s infinite' : undefined
            }}
            aria-hidden
          >
            ●
          </span>
          <span aria-hidden>·</span>
          <span className="v">{nodes.length} RESOURCES</span>
        </span>
      </div>

      <div className="cluster">
        <button
          type="button"
          className="statusbar-pair -clickable"
          onClick={() => setView(view === 'topology' ? 'graph' : 'topology')}
        >
          <span className="k">VIEW</span>
          <span aria-hidden>·</span>
          <span className="v">{viewLabel}</span>
        </button>
        <span className="statusbar-pair">
          <span className="k">⌘K</span>
          <span aria-hidden>·</span>
          <span className="v">SEARCH</span>
        </span>
        <span className="statusbar-pair">
          <span className="k">?</span>
          <span aria-hidden>·</span>
          <span className="v">KEYS</span>
        </span>
      </div>
    </footer>
  )
}
