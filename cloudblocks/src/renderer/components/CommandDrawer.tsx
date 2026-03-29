import { useState, useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import { useCliStore } from '../store/cli'

export function CommandDrawer(): React.JSX.Element {
  const cliOutput         = useCliStore((s) => s.cliOutput)
  const commandPreview    = useCliStore((s) => s.commandPreview)
  const pendingCommand    = useCliStore((s) => s.pendingCommand)
  const logHistory        = useCliStore((s) => s.logHistory)
  const clearLogHistory   = useCliStore((s) => s.clearLogHistory)
  const activeCreate      = useUIStore((s) => s.activeCreate)
  const activeFilters     = useUIStore((s) => s.activeFilters)
  const removeFilter      = useUIStore((s) => s.removeFilter)
  const appendCliOutput   = useCliStore((s) => s.appendCliOutput)
  const clearCliOutput    = useCliStore((s) => s.clearCliOutput)
  const clearPendingNodes = useCloudStore((s) => s.clearPendingNodes)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)

  const [expanded,  setExpanded]  = useState(false)
  const [running,   setRunning]   = useState(false)
  const [exitCode,  setExitCode]  = useState<number | null>(null)
  const [showLogs,  setShowLogs]  = useState(false)
  const logRef     = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom on new output
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [cliOutput])

  // Auto-scroll history panel to bottom on new entries
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [logHistory])

  // Reset drawer when modal closes
  useEffect(() => {
    if (!activeCreate) {
      setRunning(false) // eslint-disable-line react-hooks/set-state-in-effect
      setExitCode(null)
    }
  }, [activeCreate])

  // Subscribe to IPC streaming events
  useEffect(() => {
    const offOutput = window.cloudblocks.onCliOutput((entry) => {
      appendCliOutput(entry)
      setExpanded(true)
    })
    const offDone = window.cloudblocks.onCliDone((result) => {
      setRunning(false)
      setExitCode(result.code)
      if (result.code === 0) {
        useUIStore.getState().showToast('Done')
      } else {
        useUIStore.getState().showToast('Command failed', 'error')
      }
    })
    return () => { offOutput(); offDone() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRun(): Promise<void> {
    if (running || commandPreview.length === 0) return
    if (pendingCommand) {
      // Quick action / delete / edit — commands pre-built in store
      setRunning(true)
      setExitCode(null)
      setExpanded(true)
      clearCliOutput()
      try {
        const result = await window.cloudblocks.runCli(pendingCommand)
        if (result.code === 0) {
          useUIStore.getState().showToast('Done')
          await window.cloudblocks.startScan()
        } else {
          useUIStore.getState().showToast('Command failed', 'error')
        }
      } finally {
        setRunning(false)
        setPendingCommand(null)
        setCommandPreview([])
      }
    } else {
      // Create modal path — CommandDrawer signals modal to run
      setRunning(true)
      setExitCode(null)
      setExpanded(true)
      clearCliOutput()
      window.dispatchEvent(new CustomEvent('commanddrawer:run'))
    }
  }

  function handleCancel(): void {
    window.cloudblocks.cancelCli()
    clearPendingNodes()
    setRunning(false)
    setExpanded(false)
  }

  function handleCollapse(): void {
    setExpanded(false)
    clearCliOutput()
    setExitCode(null)
  }

  function handleToggleLogs(): void {
    setShowLogs((prev) => {
      if (!prev) setExpanded(false)
      return !prev
    })
  }

  const showRun     = (!!activeCreate || !!pendingCommand) && !running && exitCode === null && commandPreview.length > 0
  const showSuccess = exitCode === 0
  const showError   = exitCode !== null && exitCode !== 0

  const statusText = running
    ? 'Running…'
    : showSuccess
    ? '[OK]'
    : showError
    ? `[ERR ${exitCode}]`
    : commandPreview.length > 0
    ? commandPreview[0]   // show first line of multi-command preview
    : 'Right-click canvas to create a resource'

  return (
    <div style={{ background: 'var(--cb-bg-panel)', borderTop: '1px solid var(--cb-accent)', fontFamily: 'monospace', flexShrink: 0 }}>
      {/* Command preview area — all lines, one per row */}
      {commandPreview.length > 0 && !running && exitCode === null && (
        <div style={{ padding: '6px 10px', background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)' }}>
          {commandPreview.map((line, i) => (
            <div key={i} style={{ color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: '12px' }}>{line}</div>
          ))}
        </div>
      )}

      {/* Expanded log area */}
      {expanded && (
        <div
          ref={logRef}
          style={{ height: '120px', overflowY: 'auto', padding: '6px 10px', background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)', fontSize: '10px', lineHeight: '1.6' }}
        >
          {cliOutput.length === 0 ? (
            <span style={{ color: 'var(--cb-text-muted)' }}>Waiting for output…</span>
          ) : (
            cliOutput.map((entry, i) => (
              <div key={i} style={{ color: entry.stream === 'stderr' ? '#febc2e' : 'var(--cb-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.line}
              </div>
            ))
          )}
        </div>
      )}

      {/* Log history panel */}
      {showLogs && (
        <div style={{ height: '160px', overflowY: 'auto', background: 'var(--cb-bg-panel)', borderBottom: '1px solid var(--cb-border-strong)', fontSize: '10px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 10px', borderBottom: '1px solid var(--cb-border-strong)' }}>
            <span style={{ color: 'var(--cb-text-muted)', fontSize: '9px', fontFamily: 'monospace' }}>Session Log</span>
            <button
              onClick={clearLogHistory}
              style={{ background: 'transparent', border: '1px solid #ff5f57', borderRadius: '2px', color: '#ff5f57', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace', padding: '0px 5px' }}
            >
              ✕ Clear
            </button>
          </div>
          <div ref={historyRef} style={{ height: 'calc(160px - 24px)', overflowY: 'auto', padding: '6px 10px' }}>
            {logHistory.length === 0 ? (
              <span style={{ color: 'var(--cb-text-muted)' }}>No commands run this session.</span>
            ) : (
              logHistory.map((entry, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <span style={{ color: 'var(--cb-text-muted)', fontSize: '9px', marginRight: '6px' }}>
                    {new Date(entry.ts).toLocaleTimeString()}
                  </span>
                  <span style={{ color: entry.stream === 'stderr' ? '#febc2e' : 'var(--cb-text-primary)' }}>
                    {entry.line}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderTop: '1px solid var(--cb-border)', flexWrap: 'wrap' }}>
          {activeFilters.map((f) => (
            <span
              key={f.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-accent)', borderRadius: 3, padding: '1px 5px', fontSize: 9, color: 'var(--cb-accent)', fontFamily: 'monospace' }}
            >
              ⊡ {f.label}
              <button
                onClick={() => removeFilter(f.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--cb-accent)', cursor: 'pointer', fontSize: 10, lineHeight: 1, padding: 0 }}
                title="Clear filter"
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Bottom strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', minHeight: '26px' }}>
        <span style={{ color: 'var(--cb-accent)', fontSize: '9px' }}>$</span>

        <code style={{ fontSize: '9px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: commandPreview.length > 0 || running ? 'var(--cb-text-primary)' : 'var(--cb-text-muted)' }}>
          {statusText}
        </code>

        {showRun && (
          <button
            onClick={handleRun}
            style={{ background: '#22c55e', borderRadius: '2px', padding: '1px 8px', color: '#000', fontSize: '9px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            Run
          </button>
        )}

        {running && (
          <button
            onClick={handleCancel}
            style={{ background: 'var(--cb-bg-elevated)', border: '1px solid #ff5f57', borderRadius: '2px', padding: '1px 8px', color: '#ff5f57', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            Cancel
          </button>
        )}

        {(showSuccess || showError) && (
          <button
            onClick={handleCollapse}
            style={{ background: 'transparent', border: 'none', color: 'var(--cb-text-muted)', fontSize: '11px', cursor: 'pointer' }}
          >
            ✕
          </button>
        )}

        {cliOutput.length > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--cb-text-muted)', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ▲
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'transparent', border: 'none', color: 'var(--cb-text-muted)', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ▼
          </button>
        )}

        <button
          onClick={handleToggleLogs}
          style={{ background: 'transparent', border: 'none', color: showLogs ? '#febc2e' : 'var(--cb-text-muted)', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          ⊟ Logs
        </button>
      </div>
    </div>
  )
}
