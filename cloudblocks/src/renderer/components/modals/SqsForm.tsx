import React, { useState } from 'react'
import type { SqsParams } from '../../types/create'

interface Props {
  onChange: (p: SqsParams) => void
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
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 8,
  color: 'var(--cb-text-secondary)',
  fontFamily: 'monospace',
  fontSize: 10
}

export function SqsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [fifo, setFifo] = useState(false)
  const [visibilityTimeout, setVisibilityTimeout] = useState('')

  const err = showErrors ?? false

  const emit = (n: string, f: boolean, vt: string): void => {
    onChange({
      resource: 'sqs',
      name: n,
      fifo: f || undefined,
      visibilityTimeout: vt ? Number(vt) : undefined
    })
  }

  return (
    <div>
      <div style={lbl}>Queue Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-queue"
        onChange={(e) => {
          setName(e.target.value)
          emit(e.target.value, fifo, visibilityTimeout)
        }}
      />

      <div style={lbl}>Visibility Timeout (seconds)</div>
      <input
        style={inp(false)}
        type="number"
        value={visibilityTimeout}
        placeholder="30"
        min={0}
        max={43200}
        onChange={(e) => {
          setVisibilityTimeout(e.target.value)
          emit(name, fifo, e.target.value)
        }}
      />

      <label style={checkRow}>
        <input
          type="checkbox"
          checked={fifo}
          onChange={(e) => {
            setFifo(e.target.checked)
            emit(name, e.target.checked, visibilityTimeout)
          }}
        />
        FIFO Queue (.fifo suffix added automatically)
      </label>
    </div>
  )
}
