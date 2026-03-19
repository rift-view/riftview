import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { Ec2EditParams } from '../../types/edit'
import { useCloudStore } from '../../store/cloud'

interface Props { node: CloudNode; onChange: (p: Ec2EditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const sel = inp
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function Ec2EditForm({ node, onChange }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const [name, setName]       = useState((node.metadata.name as string) ?? node.label)
  const [instType, setInstType] = useState((node.metadata.instanceType as string) ?? 't3.micro')
  const [sgIds, setSgIds]     = useState<string[]>((node.metadata.securityGroupIds as string[]) ?? [])

  const sgs = nodes.filter(n => n.type === 'security-group')

  const emit = (overrides: Partial<Ec2EditParams>): void =>
    onChange({ resource: 'ec2', name, instanceType: instType, securityGroupIds: sgIds, ...overrides })

  const toggleSg = (id: string): void => {
    const next = sgIds.includes(id) ? sgIds.filter(x => x !== id) : [...sgIds, id]
    setSgIds(next)
    emit({ securityGroupIds: next })
  }

  return (
    <div>
      <div style={lbl}>Name</div>
      <input style={inp} value={name} onChange={e => { setName(e.target.value); emit({ name: e.target.value }) }} />
      <div style={lbl}>Instance type</div>
      <select style={sel} value={instType} onChange={e => { setInstType(e.target.value); emit({ instanceType: e.target.value }) }}>
        {['t3.micro','t3.small','t3.medium','t3.large','m5.large','m5.xlarge','c5.large'].map(t => <option key={t}>{t}</option>)}
      </select>
      {sgs.length > 0 && (
        <>
          <div style={lbl}>Security groups</div>
          {sgs.map(sg => (
            <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={sgIds.includes(sg.id)} onChange={() => toggleSg(sg.id)} />
              {sg.label} ({sg.id})
            </label>
          ))}
        </>
      )}
    </div>
  )
}
