import React, { useState } from 'react'
import type { EventBusParams } from '../../types/create'

interface Props {
  onChange: (p: EventBusParams) => void
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

export function EventBusForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const err = showErrors ?? false

  return (
    <div>
      <div style={lbl}>Event Bus Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-event-bus"
        onChange={(e) => {
          setName(e.target.value)
          onChange({ resource: 'eventbridge-bus', name: e.target.value })
        }}
      />
    </div>
  )
}
