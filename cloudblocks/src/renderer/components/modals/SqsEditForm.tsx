import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SqsEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SqsEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function SqsEditForm({ node, onChange }: Props): React.JSX.Element {
  const queueUrl = (node.metadata.url as string) ?? node.id
  const [visibilityTimeout, setVisibilityTimeout] = useState(
    (node.metadata.visibilityTimeout as number) ?? 30
  )
  const [messageRetentionPeriod, setMessageRetentionPeriod] = useState(
    (node.metadata.messageRetentionPeriod as number) ?? 345600
  )

  const emit = (vt: number, mrp: number): void =>
    onChange({ resource: 'sqs', queueUrl, visibilityTimeout: vt, messageRetentionPeriod: mrp })

  return (
    <div>
      <div style={lbl}>Queue URL</div>
      <input style={{ ...inp, opacity: 0.6 }} value={queueUrl} readOnly />
      <div style={lbl}>Visibility Timeout (seconds)</div>
      <input
        style={inp}
        type="number"
        min={0}
        max={43200}
        value={visibilityTimeout}
        onChange={e => {
          const v = Number(e.target.value)
          setVisibilityTimeout(v)
          emit(v, messageRetentionPeriod)
        }}
      />
      <div style={lbl}>Message Retention (seconds)</div>
      <input
        style={inp}
        type="number"
        min={60}
        max={1209600}
        value={messageRetentionPeriod}
        onChange={e => {
          const v = Number(e.target.value)
          setMessageRetentionPeriod(v)
          emit(visibilityTimeout, v)
        }}
      />
    </div>
  )
}
