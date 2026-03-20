import React, { useState } from 'react'
import type { RdsParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: RdsParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`, borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = (err: boolean): React.CSSProperties => ({ ...inp(err), cursor: 'pointer' })
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }

export function RdsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs  = nodes.filter(n => n.type === 'vpc')

  const [form, setForm] = useState<Omit<RdsParams, 'resource'>>({
    identifier: '', engine: 'mysql', instanceClass: 'db.t3.micro',
    masterUsername: '', masterPassword: '', allocatedStorage: 20,
    multiAZ: false, publiclyAccessible: false, vpcId: '', dbSubnetGroupName: '',
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'rds', ...next })
  }

  const err = showErrors ?? false

  return (
    <div>
      <div style={lbl}>DB instance identifier *</div>
      <input style={inp(err && !form.identifier)} value={form.identifier} onChange={e => update('identifier', e.target.value)} />
      <div style={lbl}>Engine</div>
      <select style={sel(false)} value={form.engine} onChange={e => update('engine', e.target.value as RdsParams['engine'])}>
        <option value="mysql">MySQL</option>
        <option value="postgres">PostgreSQL</option>
        <option value="mariadb">MariaDB</option>
      </select>
      <div style={lbl}>Instance class</div>
      <select style={sel(false)} value={form.instanceClass} onChange={e => update('instanceClass', e.target.value)}>
        {['db.t3.micro','db.t3.small','db.m5.large'].map(c => <option key={c}>{c}</option>)}
      </select>
      <div style={lbl}>Master username *</div>
      <input style={inp(err && !form.masterUsername)} value={form.masterUsername} onChange={e => update('masterUsername', e.target.value)} />
      <div style={lbl}>Master password *</div>
      <input type="password" style={inp(err && !form.masterPassword)} value={form.masterPassword} onChange={e => update('masterPassword', e.target.value)} />
      <div style={lbl}>Allocated storage (GB)</div>
      <input type="number" style={inp(false)} value={form.allocatedStorage} onChange={e => update('allocatedStorage', Number(e.target.value))} />
      {vpcs.length > 0 && (
        <>
          <div style={lbl}>VPC *</div>
          <select style={sel(err && !form.vpcId)} value={form.vpcId} onChange={e => update('vpcId', e.target.value)}>
            <option value="">— select VPC —</option>
            {vpcs.map(v => <option key={v.id} value={v.id}>{v.label} ({v.id})</option>)}
          </select>
        </>
      )}
      <div style={lbl}>DB Subnet Group</div>
      <input style={inp(false)} value={form.dbSubnetGroupName ?? ''} onChange={e => update('dbSubnetGroupName', e.target.value)} />
      <label style={row}><input type="checkbox" checked={form.multiAZ} onChange={e => update('multiAZ', e.target.checked)} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Multi-AZ</span></label>
      <label style={row}><input type="checkbox" checked={form.publiclyAccessible} onChange={e => update('publiclyAccessible', e.target.checked)} /><span style={{ fontSize: 10, color: 'var(--cb-text-secondary)' }}>Publicly accessible</span></label>
    </div>
  )
}
