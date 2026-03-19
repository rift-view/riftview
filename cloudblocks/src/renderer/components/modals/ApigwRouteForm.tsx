import React, { useState } from 'react'
import type { ApigwRouteParams } from '../../types/create'

interface Props {
  apiId: string
  onChange: (p: ApigwRouteParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const selStyle: React.CSSProperties = {
  width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'] as const

export function ApigwRouteForm({ apiId, onChange, showErrors }: Props): React.JSX.Element {
  const [method, setMethod] = useState<string>('GET')
  const [path, setPath]     = useState('')

  const err = showErrors ?? false

  const emit = (m: string, p: string): void => {
    onChange({ resource: 'apigw-route', apiId, method: m, path: p })
  }

  const pathError = err && (!path.trim() || !path.startsWith('/'))

  return (
    <div>
      <div style={lbl}>API ID</div>
      <div style={{ fontSize: 10, color: 'var(--cb-text-muted)', fontFamily: 'monospace', padding: '2px 0' }}>{apiId}</div>

      <div style={lbl}>Method</div>
      <select
        style={selStyle}
        value={method}
        onChange={(e) => { setMethod(e.target.value); emit(e.target.value, path) }}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <div style={lbl}>Path *</div>
      <input
        style={inp(pathError)}
        value={path}
        placeholder="/users"
        onChange={(e) => { setPath(e.target.value); emit(method, e.target.value) }}
      />
      {pathError && (
        <div style={{ fontSize: 8, color: '#ff5f57', marginTop: 2 }}>Path must start with /</div>
      )}
    </div>
  )
}
