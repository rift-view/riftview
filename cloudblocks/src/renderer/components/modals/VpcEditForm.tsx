import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { VpcEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: VpcEditParams) => void; showErrors?: boolean }

const inputStyle = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const label: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function VpcEditForm({ node, onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)

  const update = (v: string): void => { setName(v); onChange({ resource: 'vpc', name: v }) }

  return (
    <div>
      <div style={label}>Name</div>
      <input style={inputStyle(!!(showErrors && !name.trim()))} value={name} onChange={e => update(e.target.value)} />
    </div>
  )
}
