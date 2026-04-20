import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SnsEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SnsEditParams) => void
}

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--ink-900)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--fg)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
}
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
}

export default function SnsEditForm({ node, onChange }: Props): React.JSX.Element {
  const topicArn = node.id
  const [displayName, setDisplayName] = useState((node.metadata.displayName as string) ?? '')

  const emit = (dn: string): void => onChange({ resource: 'sns', topicArn, displayName: dn })

  return (
    <div>
      <div style={lbl}>Topic ARN</div>
      <input style={{ ...inp, opacity: 0.6 }} value={topicArn} readOnly />
      <div style={lbl}>Display Name (SMS Sender ID)</div>
      <input
        style={inp}
        type="text"
        maxLength={11}
        value={displayName}
        placeholder="Max 11 characters"
        onChange={(e) => {
          setDisplayName(e.target.value)
          emit(e.target.value)
        }}
      />
    </div>
  )
}
