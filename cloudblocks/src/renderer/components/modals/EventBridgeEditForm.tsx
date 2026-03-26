import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EventBridgeEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: EventBridgeEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function EventBridgeEditForm({ node, onChange }: Props): React.JSX.Element {
  const busName = node.label
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (desc: string): void =>
    onChange({ resource: 'eventbridge-bus', busName, description: desc })

  return (
    <div>
      <div style={lbl}>Bus Name</div>
      <input style={{ ...inp, opacity: 0.6 }} value={busName} readOnly />
      <div style={lbl}>Description (max 512 chars)</div>
      <textarea
        style={{ ...inp, height: 60, resize: 'vertical' }}
        value={description}
        maxLength={512}
        placeholder="Optional description"
        onChange={e => { setDescription(e.target.value); emit(e.target.value) }}
      />
    </div>
  )
}
