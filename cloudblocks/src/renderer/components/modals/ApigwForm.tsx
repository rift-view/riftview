import React, { useState } from 'react'
import type { ApigwParams } from '../../types/create'

interface Props { onChange: (p: ApigwParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const btnSm: React.CSSProperties = { background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '2px 6px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }

export function ApigwForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [corsInputs, setCorsInputs] = useState<string[]>([''])

  const err = showErrors ?? false

  const emit = (nextName: string, nextCors: string[]): void => {
    const corsOrigins = nextCors.filter((s) => s.trim() !== '')
    onChange({ resource: 'apigw', name: nextName, corsOrigins })
  }

  const updateCors = (newInputs: string[]): void => {
    setCorsInputs(newInputs)
    emit(name, newInputs)
  }

  return (
    <div>
      <div style={lbl}>API Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-http-api"
        onChange={(e) => { setName(e.target.value); emit(e.target.value, corsInputs) }}
      />

      <div style={lbl}>CORS Origins</div>
      {corsInputs.map((origin, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            style={{ ...inp(false), flex: 1 }}
            value={origin}
            placeholder="https://example.com"
            onChange={(e) => {
              const next = [...corsInputs]
              next[i] = e.target.value
              updateCors(next)
            }}
          />
          <button
            style={btnSm}
            onClick={() => {
              const next = corsInputs.filter((_, j) => j !== i)
              updateCors(next.length > 0 ? next : [''])
            }}
          >✕</button>
        </div>
      ))}
      <button
        style={{ ...btnSm, marginTop: 6 }}
        onClick={() => updateCors([...corsInputs, ''])}
      >+ Add Origin</button>
    </div>
  )
}
