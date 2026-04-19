import React, { useState } from 'react'
import type { SecretParams } from '../../types/create'

interface Props {
  onChange: (p: SecretParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--cb-bg-panel)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--cb-text-primary)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
})
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--cb-text-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
}

export function SecretForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const err = showErrors ?? false

  const emit = (n: string, v: string): void => {
    onChange({ resource: 'secret', name: n, value: v })
  }

  return (
    <div>
      <div style={lbl}>Secret Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-app/db-password"
        onChange={(e) => {
          setName(e.target.value)
          emit(e.target.value, value)
        }}
      />

      <div style={lbl}>Secret Value *</div>
      <input
        style={inp(err && !value.trim())}
        type="password"
        value={value}
        placeholder="super-secret-value"
        onChange={(e) => {
          setValue(e.target.value)
          emit(name, e.target.value)
        }}
      />
    </div>
  )
}
