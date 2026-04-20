import React, { useState } from 'react'
import type { SnsParams } from '../../types/create'

interface Props {
  onChange: (p: SnsParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--ink-900)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--border)'}`,
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--fg)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
})
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
}
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 8,
  color: 'var(--bone-200)',
  fontFamily: 'monospace',
  fontSize: 10
}

export function SnsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [fifo, setFifo] = useState(false)

  const err = showErrors ?? false

  const emit = (n: string, f: boolean): void => {
    onChange({ resource: 'sns', name: n, fifo: f || undefined })
  }

  return (
    <div>
      <div style={lbl}>Topic Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-topic"
        onChange={(e) => {
          setName(e.target.value)
          emit(e.target.value, fifo)
        }}
      />

      <label style={checkRow}>
        <input
          type="checkbox"
          checked={fifo}
          onChange={(e) => {
            setFifo(e.target.checked)
            emit(name, e.target.checked)
          }}
        />
        FIFO Topic (.fifo suffix added automatically)
      </label>
    </div>
  )
}
