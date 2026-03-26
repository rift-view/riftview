import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SecretEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SecretEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function SecretEditForm({ node, onChange }: Props): React.JSX.Element {
  const secretId = node.id
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (desc: string): void =>
    onChange({ resource: 'secret', secretId, description: desc })

  return (
    <div>
      <div style={lbl}>Secret ID (ARN)</div>
      <input style={{ ...inp, opacity: 0.6 }} value={secretId} readOnly />
      <div style={lbl}>Description</div>
      <textarea
        style={{ ...inp, height: 60, resize: 'vertical' }}
        value={description}
        placeholder="Optional description"
        onChange={e => { setDescription(e.target.value); emit(e.target.value) }}
      />
    </div>
  )
}
