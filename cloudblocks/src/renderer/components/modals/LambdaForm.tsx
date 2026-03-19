import React, { useState } from 'react'
import type { LambdaParams } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: LambdaParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({ width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`, borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const })
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export function LambdaForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs    = nodes.filter(n => n.type === 'vpc')
  const subnets = nodes.filter(n => n.type === 'subnet')
  const sgs     = nodes.filter(n => n.type === 'security-group')

  const [form, setForm] = useState<Omit<LambdaParams, 'resource'>>({
    name: '', runtime: 'nodejs20.x', handler: 'index.handler', roleArn: '',
    memorySize: 128, timeout: 3,
  })

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'lambda', ...next })
  }

  const err = showErrors ?? false
  const filteredSubnets = form.vpcId ? subnets.filter(s => s.parentId === form.vpcId) : subnets

  return (
    <div>
      <div style={lbl}>Function name *</div>
      <input style={inp(err && !form.name)} value={form.name} onChange={e => update('name', e.target.value)} />
      <div style={lbl}>Runtime</div>
      <select style={sel(false)} value={form.runtime} onChange={e => update('runtime', e.target.value as LambdaParams['runtime'])}>
        {['nodejs20.x','python3.12','java21','go1.x'].map(r => <option key={r}>{r}</option>)}
      </select>
      <div style={lbl}>Handler</div>
      <input style={inp(err && !form.handler)} value={form.handler} onChange={e => update('handler', e.target.value)} />
      <div style={lbl}>Role ARN *</div>
      <input style={inp(err && !form.roleArn)} value={form.roleArn} onChange={e => update('roleArn', e.target.value)} />
      <div style={lbl}>Memory (MB)</div>
      <input type="number" style={inp(false)} value={form.memorySize} onChange={e => update('memorySize', Number(e.target.value))} />
      <div style={lbl}>Timeout (s)</div>
      <input type="number" style={inp(false)} value={form.timeout} onChange={e => update('timeout', Number(e.target.value))} />
      {vpcs.length > 0 && (
        <>
          <div style={lbl}>VPC (optional)</div>
          <select style={sel(false)} value={form.vpcId ?? ''} onChange={e => update('vpcId', e.target.value || undefined)}>
            <option value="">— none —</option>
            {vpcs.map(v => <option key={v.id} value={v.id}>{v.label} ({v.id})</option>)}
          </select>
        </>
      )}
      {form.vpcId && (
        <>
          <div style={lbl}>Subnets *</div>
          {filteredSubnets.map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={(form.subnetIds ?? []).includes(s.id)} onChange={e => {
                const ids = form.subnetIds ?? []
                update('subnetIds', e.target.checked ? [...ids, s.id] : ids.filter(x => x !== s.id))
              }} />
              {s.label} ({s.id})
            </label>
          ))}
          <div style={lbl}>Security groups *</div>
          {sgs.map(sg => (
            <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={(form.securityGroupIds ?? []).includes(sg.id)} onChange={e => {
                const ids = form.securityGroupIds ?? []
                update('securityGroupIds', e.target.checked ? [...ids, sg.id] : ids.filter(x => x !== sg.id))
              }} />
              {sg.label} ({sg.id})
            </label>
          ))}
        </>
      )}
    </div>
  )
}
