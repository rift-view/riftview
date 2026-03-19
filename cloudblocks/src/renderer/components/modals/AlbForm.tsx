import React, { useState } from 'react'
import type { AlbParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: AlbParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`, borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export function AlbForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes   = useCloudStore((s) => s.nodes)
  const vpcs    = nodes.filter(n => n.type === 'vpc')
  const subnets = nodes.filter(n => n.type === 'subnet')
  const sgs     = nodes.filter(n => n.type === 'security-group')

  const [form, setForm] = useState<Omit<AlbParams, 'resource'>>({
    name: '', scheme: 'internet-facing', subnetIds: [], securityGroupIds: [], vpcId: '',
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'alb', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter(s => s.parentId === form.vpcId) : subnets
  const filteredSgs = form.vpcId ? sgs.filter(s => s.parentId === form.vpcId) : sgs

  return (
    <div>
      <div style={lbl}>Name *</div>
      <input style={inp(err && !form.name)} value={form.name} onChange={e => update('name', e.target.value)} />
      <div style={lbl}>Scheme</div>
      <select style={sel(false)} value={form.scheme} onChange={e => update('scheme', e.target.value as AlbParams['scheme'])}>
        <option value="internet-facing">Internet-facing</option>
        <option value="internal">Internal</option>
      </select>
      {vpcs.length > 0 && (
        <>
          <div style={lbl}>VPC</div>
          <select style={sel(false)} value={form.vpcId} onChange={e => update('vpcId', e.target.value)}>
            <option value="">— select VPC —</option>
            {vpcs.map(v => <option key={v.id} value={v.id}>{v.label} ({v.id})</option>)}
          </select>
        </>
      )}
      <div style={lbl}>Subnets (select ≥2) *</div>
      {filteredSubnets.map(s => (
        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.subnetIds.includes(s.id)} onChange={e => {
            const ids = form.subnetIds
            update('subnetIds', e.target.checked ? [...ids, s.id] : ids.filter(x => x !== s.id))
          }} />
          {s.label} ({s.id})
        </label>
      ))}
      <div style={lbl}>Security groups *</div>
      {filteredSgs.map(sg => (
        <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.securityGroupIds.includes(sg.id)} onChange={e => {
            const ids = form.securityGroupIds
            update('securityGroupIds', e.target.checked ? [...ids, sg.id] : ids.filter(x => x !== sg.id))
          }} />
          {sg.label} ({sg.id})
        </label>
      ))}
    </div>
  )
}
