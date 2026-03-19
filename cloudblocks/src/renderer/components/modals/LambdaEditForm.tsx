import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { LambdaEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: LambdaEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function LambdaEditForm({ node, onChange }: Props): React.JSX.Element {
  const [memory, setMemory]   = useState(Number(node.metadata.memorySize) || 128)
  const [timeout, setTimeout] = useState(Number(node.metadata.timeout) || 3)
  const [envStr, setEnvStr]   = useState(() => {
    const env = node.metadata.environment as Record<string, string> | undefined
    return env ? Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  })

  const parseEnv = (s: string): Record<string, string> =>
    Object.fromEntries(s.split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)] }))

  const emit = (overrides: Partial<LambdaEditParams>): void =>
    onChange({ resource: 'lambda', memorySize: memory, timeout, environment: parseEnv(envStr), ...overrides })

  return (
    <div>
      <div style={lbl}>Memory (MB)</div>
      <input type="number" style={inp} value={memory} onChange={e => { setMemory(Number(e.target.value)); emit({ memorySize: Number(e.target.value) }) }} />
      <div style={lbl}>Timeout (s)</div>
      <input type="number" style={inp} value={timeout} onChange={e => { setTimeout(Number(e.target.value)); emit({ timeout: Number(e.target.value) }) }} />
      <div style={lbl}>Environment variables (KEY=value, one per line)</div>
      <textarea style={{ ...inp, height: 60, resize: 'vertical' }} value={envStr} onChange={e => { setEnvStr(e.target.value); emit({ environment: parseEnv(e.target.value) }) }} />
    </div>
  )
}
