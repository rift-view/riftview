import { useState, useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'

export function CommandDrawer(): JSX.Element {
  const cliOutput        = useCloudStore((s) => s.cliOutput)
  const commandPreview   = useCloudStore((s) => s.commandPreview)
  const activeCreate     = useCloudStore((s) => s.activeCreate)
  const appendCliOutput  = useCloudStore((s) => s.appendCliOutput)
  const clearCliOutput   = useCloudStore((s) => s.clearCliOutput)
  const clearPendingNodes = useCloudStore((s) => s.clearPendingNodes)

  const [expanded, setExpanded] = useState(false)
  const [running,  setRunning]  = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom on new output
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [cliOutput])

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
    })
    return () => { offOutput(); offDone() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRun(): void {
    if (running || !commandPreview) return
    setRunning(true)
    setExitCode(null)
    setExpanded(true)
    clearCliOutput()
    window.dispatchEvent(new CustomEvent('commanddrawer:run'))
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

  const showRun     = !!activeCreate && !running && exitCode === null && !!commandPreview
  const showSuccess = exitCode === 0
  const showError   = exitCode !== null && exitCode !== 0

  const statusText = running
    ? 'Running…'
    : showSuccess
    ? '[OK]'
    : showError
    ? `[ERR ${exitCode}]`
    : commandPreview
    ? commandPreview.split('\n')[0]   // show first line of multi-command preview
    : 'Right-click canvas to create a resource'

  return (
    <div style={{ background: '#0d1117', borderTop: '1px solid #FF9900', fontFamily: 'monospace', flexShrink: 0 }}>
      {/* Expanded log area */}
      {expanded && (
        <div
          ref={logRef}
          style={{ height: '120px', overflowY: 'auto', padding: '6px 10px', background: '#060d14', borderBottom: '1px solid #1e2d40', fontSize: '10px', lineHeight: '1.6' }}
        >
          {cliOutput.length === 0 ? (
            <span style={{ color: '#555' }}>Waiting for output…</span>
          ) : (
            cliOutput.map((entry, i) => (
              <div key={i} style={{ color: entry.stream === 'stderr' ? '#febc2e' : '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.line}
              </div>
            ))
          )}
        </div>
      )}

      {/* Bottom strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', minHeight: '26px' }}>
        <span style={{ color: '#FF9900', fontSize: '9px' }}>$</span>

        <code style={{ fontSize: '9px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: commandPreview || running ? '#eee' : '#444' }}>
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
            style={{ background: '#1a2332', border: '1px solid #ff5f57', borderRadius: '2px', padding: '1px 8px', color: '#ff5f57', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            Cancel
          </button>
        )}

        {(showSuccess || showError) && (
          <button
            onClick={handleCollapse}
            style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '11px', cursor: 'pointer' }}
          >
            ✕
          </button>
        )}

        {cliOutput.length > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ▲
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            style={{ background: 'transparent', border: 'none', color: '#555', fontSize: '9px', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ▼
          </button>
        )}
      </div>
    </div>
  )
}
