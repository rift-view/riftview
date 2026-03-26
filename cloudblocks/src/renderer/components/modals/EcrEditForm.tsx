import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { EcrEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: EcrEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function EcrEditForm({ node, onChange }: Props): React.JSX.Element {
  const repositoryName = (node.metadata.repositoryName as string) ?? node.label
  const [imageTagMutability, setImageTagMutability] = useState<'MUTABLE' | 'IMMUTABLE'>(
    (node.metadata.imageTagMutability as 'MUTABLE' | 'IMMUTABLE') ?? 'MUTABLE'
  )
  const [scanOnPush, setScanOnPush] = useState<boolean>(
    (node.metadata.scanOnPush as boolean) ?? false
  )

  const emit = (mut: 'MUTABLE' | 'IMMUTABLE', sop: boolean): void =>
    onChange({ resource: 'ecr-repo', repositoryName, imageTagMutability: mut, scanOnPush: sop })

  return (
    <div>
      <div style={lbl}>Repository Name</div>
      <input style={{ ...inp, opacity: 0.6 }} value={repositoryName} readOnly />
      <div style={lbl}>Image Tag Mutability</div>
      <select
        style={inp}
        value={imageTagMutability}
        onChange={e => {
          const v = e.target.value as 'MUTABLE' | 'IMMUTABLE'
          setImageTagMutability(v)
          emit(v, scanOnPush)
        }}
      >
        <option value="MUTABLE">MUTABLE</option>
        <option value="IMMUTABLE">IMMUTABLE</option>
      </select>
      <div style={{ ...lbl, marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          id="ecr-scan-on-push"
          checked={scanOnPush}
          onChange={e => { setScanOnPush(e.target.checked); emit(imageTagMutability, e.target.checked) }}
        />
        <label htmlFor="ecr-scan-on-push" style={{ fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase' }}>
          Scan on Push
        </label>
      </div>
    </div>
  )
}
