import React, { useState } from 'react'
import type { EcrParams } from '../../types/create'

interface Props { onChange: (p: EcrParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export function EcrForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const err = showErrors ?? false

  return (
    <div>
      <div style={lbl}>Repository Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-app/service"
        onChange={(e) => { setName(e.target.value); onChange({ resource: 'ecr', name: e.target.value }) }}
      />
    </div>
  )
}
