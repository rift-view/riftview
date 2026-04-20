import { useState, useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'
import { useUIStore } from '../store/ui'
import { useCliStore } from '../store/cli'

export function CommandDrawer(): React.JSX.Element {
  const cliOutput = useCliStore((s) => s.cliOutput)
  const commandPreview = useCliStore((s) => s.commandPreview)
  const pendingCommand = useCliStore((s) => s.pendingCommand)
  const logHistory = useCliStore((s) => s.logHistory)
  const clearLogHistory = useCliStore((s) => s.clearLogHistory)
  const activeCreate = useUIStore((s) => s.activeCreate)
  const activeFilters = useUIStore((s) => s.activeFilters)
  const removeFilter = useUIStore((s) => s.removeFilter)
  const appendCliOutput = useCliStore((s) => s.appendCliOutput)
  const clearCliOutput = useCliStore((s) => s.clearCliOutput)
  const clearPendingNodes = useCloudStore((s) => s.clearPendingNodes)
  const setPendingCommand = useCliStore((s) => s.setPendingCommand)
  const setCommandPreview = useCliStore((s) => s.setCommandPreview)

  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [exitCode, setExitCode] = useState<number | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
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
      setRunning(false)
      setExitCode(null)
    }
  }, [activeCreate])

  // Subscribe to IPC streaming events
  useEffect(() => {
    const offOutput = window.riftview.onCliOutput((entry) => {
      appendCliOutput(entry)
      setExpanded(true)
    })
    const offDone = window.riftview.onCliDone((result) => {
      setRunning(false)
      setExitCode(result.code)
      if (result.code === 0) {
        useUIStore.getState().showToast('Done')
      } else {
        useUIStore.getState().showToast('Command failed', 'error')
      }
    })
    return () => {
      offOutput()
      offDone()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRun(): Promise<void> {
    if (running || commandPreview.length === 0) return
    if (pendingCommand) {
      setRunning(true)
      setExitCode(null)
      setExpanded(true)
      clearCliOutput()
      try {
        const result = await window.riftview.runCli(pendingCommand)
        if (result.code === 0) {
          useUIStore.getState().showToast('Done')
          await window.riftview.startScan()
        } else {
          useUIStore.getState().showToast('Command failed', 'error')
        }
      } finally {
        setRunning(false)
        setPendingCommand(null)
        setCommandPreview([])
      }
    } else {
      setRunning(true)
      setExitCode(null)
      setExpanded(true)
      clearCliOutput()
      window.dispatchEvent(new CustomEvent('commanddrawer:run'))
    }
  }

  function handleCancel(): void {
    window.riftview.cancelCli()
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

  const showRun =
    (!!activeCreate || !!pendingCommand) &&
    !running &&
    exitCode === null &&
    commandPreview.length > 0
  const showSuccess = exitCode === 0
  const showError = exitCode !== null && exitCode !== 0

  const statusText = running
    ? 'Running…'
    : showSuccess
      ? '[OK]'
      : showError
        ? `[ERR ${exitCode}]`
        : commandPreview.length > 0
          ? commandPreview[0]
          : 'Right-click canvas to create a resource'

  return (
    <div
      className="term"
      style={{
        borderTop: '1px solid var(--ember-700)',
        borderRadius: 0,
        boxShadow: 'none',
        flexShrink: 0,
        background: 'var(--ink-900)'
      }}
    >
      {/* Command preview — one line per row, shown pre-run */}
      {commandPreview.length > 0 && !running && exitCode === null && (
        <div
          className="term-body"
          style={{
            padding: '6px 10px',
            borderBottom: '1px solid var(--ink-800)'
          }}
        >
          {commandPreview.map((line, i) => (
            <div
              key={i}
              style={{ color: 'var(--bone-200)', fontFamily: 'var(--font-mono)', fontSize: 12 }}
            >
              <span className="c-prompt" style={{ marginRight: 6 }}>$</span>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* Expanded log area */}
      {expanded && (
        <div
          ref={logRef}
          className="term-body"
          style={{
            height: 120,
            overflowY: 'auto',
            padding: '6px 10px',
            borderBottom: '1px solid var(--ink-800)',
            fontSize: 10,
            lineHeight: 1.6
          }}
        >
          {cliOutput.length === 0 ? (
            <span className="c-dim">Waiting for output…</span>
          ) : (
            cliOutput.map((entry, i) => (
              <div
                key={i}
                className={entry.stream === 'stderr' ? 'c-err' : ''}
                style={{
                  color: entry.stream === 'stderr' ? undefined : 'var(--bone-200)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {entry.line}
              </div>
            ))
          )}
        </div>
      )}

      {/* Log history panel */}
      {showLogs && (
        <div
          style={{
            height: 160,
            overflowY: 'auto',
            background: 'var(--ink-1000)',
            borderBottom: '1px solid var(--ink-800)',
            fontSize: 10,
            lineHeight: 1.6
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 10px',
              borderBottom: '1px solid var(--ink-800)'
            }}
          >
            <span className="label">Session Log</span>
            <button
              onClick={clearLogHistory}
              className="btn btn-sm btn-ghost"
              style={{
                fontSize: 9,
                padding: '0 6px',
                color: 'var(--fault-500)',
                borderColor: 'var(--fault-500)'
              }}
            >
              ✕ Clear
            </button>
          </div>
          <div
            ref={historyRef}
            style={{
              height: 'calc(160px - 24px)',
              overflowY: 'auto',
              padding: '6px 10px'
            }}
          >
            {logHistory.length === 0 ? (
              <span className="c-dim">No commands run this session.</span>
            ) : (
              logHistory.map((entry, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  <span className="c-dim" style={{ marginRight: 6, fontSize: 9 }}>
                    {new Date(entry.ts).toLocaleTimeString()}
                  </span>
                  <span
                    className={entry.stream === 'stderr' ? 'c-err' : ''}
                    style={{
                      color: entry.stream === 'stderr' ? undefined : 'var(--bone-200)'
                    }}
                  >
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap'
          }}
        >
          {activeFilters.map((f) => (
            <span
              key={f.id}
              className="pill"
              style={{
                padding: '1px 6px',
                borderColor: 'var(--ember-500)',
                color: 'var(--ember-400)',
                fontSize: 9
              }}
            >
              ⊡ {f.label}
              <button
                onClick={() => removeFilter(f.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ember-400)',
                  cursor: 'pointer',
                  fontSize: 10,
                  lineHeight: 1,
                  padding: 0,
                  marginLeft: 4
                }}
                title="Clear filter"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Bottom strip */}
      <div
        className="term-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          minHeight: 26,
          background: 'var(--bg-elev-1)',
          borderBottom: 0,
          textTransform: 'none',
          letterSpacing: 0
        }}
      >
        <span className="dot" style={{ background: 'var(--fault-500)' }} />
        <span className="dot" style={{ background: 'var(--ember-500)' }} />
        <span className="dot" style={{ background: 'var(--moss-500)' }} />
        <span className="c-prompt" style={{ marginLeft: 6, fontSize: 9 }}>
          $
        </span>

        <code
          style={{
            fontSize: 9,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-mono)',
            color:
              commandPreview.length > 0 || running
                ? 'var(--bone-100)'
                : 'var(--fg-muted)'
          }}
        >
          {statusText}
        </code>

        {showRun && (
          <button
            onClick={handleRun}
            className="btn btn-sm btn-primary"
            style={{ fontSize: 9, padding: '1px 10px' }}
          >
            Run
          </button>
        )}

        {running && (
          <button
            onClick={handleCancel}
            className="btn btn-sm btn-ghost"
            style={{
              color: 'var(--fault-500)',
              borderColor: 'var(--fault-500)',
              fontSize: 9,
              padding: '1px 8px'
            }}
          >
            Cancel
          </button>
        )}

        {(showSuccess || showError) && (
          <button
            onClick={handleCollapse}
            className="btn-link"
            style={{ fontSize: 11 }}
          >
            ✕
          </button>
        )}

        {cliOutput.length > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="btn-link"
            style={{ fontSize: 9 }}
          >
            ▲
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="btn-link"
            style={{ fontSize: 9 }}
          >
            ▼
          </button>
        )}

        <button
          onClick={handleToggleLogs}
          className="btn btn-sm btn-ghost"
          style={{
            fontSize: 9,
            padding: '0 6px',
            color: showLogs ? 'var(--ember-500)' : 'var(--fg-muted)',
            borderColor: showLogs ? 'var(--ember-500)' : 'var(--border)'
          }}
        >
          ⊟ Logs
        </button>
      </div>
    </div>
  )
}
