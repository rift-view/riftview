import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { RdsEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: RdsEditParams) => void }

const sel: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export default function RdsEditForm({ node, onChange }: Props): React.JSX.Element {
  const [cls, setCls]    = useState((node.metadata.dbInstanceClass as string) ?? 'db.t3.micro')
  const [multiAZ, setMultiAZ] = useState(!!(node.metadata.multiAZ))
  const [delProt, setDelProt] = useState(!!(node.metadata.deletionProtection))

  const emit = (overrides: Partial<RdsEditParams>): void =>
    onChange({ resource: 'rds', dbInstanceClass: cls, multiAZ, deletionProtection: delProt, ...overrides })

  return (
    <div>
      <div style={lbl}>Instance class</div>
      <select style={sel} value={cls} onChange={e => { setCls(e.target.value); emit({ dbInstanceClass: e.target.value }) }}>
        {['db.t3.micro','db.t3.small','db.m5.large'].map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label style={row}><input type="checkbox" checked={multiAZ} onChange={e => { setMultiAZ(e.target.checked); emit({ multiAZ: e.target.checked }) }} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Multi-AZ</span></label>
      <label style={row}><input type="checkbox" checked={delProt} onChange={e => { setDelProt(e.target.checked); emit({ deletionProtection: e.target.checked }) }} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Deletion protection</span></label>
    </div>
  )
}
