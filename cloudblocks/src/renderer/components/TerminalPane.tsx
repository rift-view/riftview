import React, { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useUIStore } from '../store/ui'
import '@xterm/xterm/css/xterm.css'

export function TerminalPane(): React.JSX.Element | null {
  const sessionId = useUIStore((s) => s.terminalSessionId)
  const nodeId    = useUIStore((s) => s.terminalNodeId)
  const closePane = useUIStore((s) => s.closeTerminalPane)
  const termRef   = useRef<HTMLDivElement>(null)
  const xtermRef  = useRef<Terminal | null>(null)
  const fitRef    = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!sessionId || !termRef.current) return

    const term = new Terminal({
      theme: { background: '#0d1117', foreground: '#e6edf3', cursor: '#FF9900' },
      fontSize: 13,
      fontFamily: 'monospace',
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current)
    fitAddon.fit()
    xtermRef.current = term
    fitRef.current   = fitAddon

    const cleanup = window.terminus?.onTerminalOutput?.((data) => {
      if (data.sessionId === sessionId) term.write(data.data)
    })

    term.onData((data) => {
      window.terminus?.sendTerminalInput?.(sessionId, data).catch(() => {})
    })

    return () => {
      cleanup?.()
      term.dispose()
      window.terminus?.closeTerminal?.(sessionId).catch(() => {})
    }
  }, [sessionId])

  if (!sessionId) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 300,
      background: '#0d1117', borderTop: '2px solid var(--cb-accent)',
      zIndex: 500, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 12px', borderBottom: '1px solid var(--cb-border)',
        color: 'var(--cb-text-muted)', fontSize: 11,
      }}>
        <span style={{ color: 'var(--cb-accent)', fontFamily: 'monospace' }}>
          SSM › {nodeId}
        </span>
        <button
          onClick={() => {
            closePane()
            window.terminus?.closeTerminal?.(sessionId).catch(() => {})
          }}
          style={{ background: 'none', border: 'none', color: 'var(--cb-text-muted)', cursor: 'pointer', fontSize: 14 }}
        >
          ✕
        </button>
      </div>
      <div ref={termRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  )
}
