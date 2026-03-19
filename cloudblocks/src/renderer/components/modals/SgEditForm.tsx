import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SgEditParams, SgRule } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SgEditParams) => void }

const inp: React.CSSProperties = { background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '2px 4px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 9, boxSizing: 'border-box' as const }

export default function SgEditForm({ node, onChange }: Props): React.JSX.Element {
  const initial: SgRule[] = (node.metadata.rules as SgRule[]) ?? []
  const [rules, setRules] = useState<SgRule[]>(initial.length > 0 ? initial : [{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }])

  const update = (next: SgRule[]): void => { setRules(next); onChange({ resource: 'sg', rules: next }) }

  const setRule = (i: number, field: keyof SgRule, value: string | number): void => {
    const next = rules.map((r, idx) => idx === i ? { ...r, [field]: value } : r)
    update(next)
  }

  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Inbound rules</div>
      {rules.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
          <select style={{ ...inp, width: 60 }} value={r.protocol} onChange={e => setRule(i, 'protocol', e.target.value)}>
            {['tcp','udp','icmp','-1'].map(p => <option key={p} value={p}>{p === '-1' ? 'all' : p}</option>)}
          </select>
          <input style={{ ...inp, width: 40 }} type="number" value={r.fromPort} onChange={e => setRule(i, 'fromPort', Number(e.target.value))} />
          <span style={{ color: 'var(--cb-text-muted)', fontSize: 9 }}>-</span>
          <input style={{ ...inp, width: 40 }} type="number" value={r.toPort} onChange={e => setRule(i, 'toPort', Number(e.target.value))} />
          <input style={{ ...inp, flex: 1 }} value={r.cidr} onChange={e => setRule(i, 'cidr', e.target.value)} />
          <button onClick={() => update(rules.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ff5f57', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>✕</button>
        </div>
      ))}
      <button onClick={() => update([...rules, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' }])} style={{ background: 'none', border: '1px solid var(--cb-border)', borderRadius: 3, color: 'var(--cb-text-secondary)', fontSize: 9, padding: '2px 8px', cursor: 'pointer', marginTop: 2 }}>
        + Add rule
      </button>
    </div>
  )
}
