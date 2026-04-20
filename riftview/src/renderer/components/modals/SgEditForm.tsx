import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SgEditParams, SgRule } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SgEditParams) => void
}

export default function SgEditForm({ node, onChange }: Props): React.JSX.Element {
  const initial: SgRule[] = (node.metadata.rules as SgRule[]) ?? []
  const [rules, setRules] = useState<SgRule[]>(
    initial.length > 0
      ? initial
      : [{ protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }]
  )

  const update = (next: SgRule[]): void => {
    setRules(next)
    onChange({ resource: 'sg', rules: next })
  }

  const setRule = (i: number, field: keyof SgRule, value: string | number): void => {
    const next = rules.map((r, idx) => (idx === i ? { ...r, [field]: value } : r))
    update(next)
  }

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Inbound rules</span>
        {rules.map((r, i) => (
          <div
            key={i}
            style={{ display: 'flex', gap: 4, marginTop: i === 0 ? 0 : 4, alignItems: 'center' }}
          >
            <select
              className="form-select"
              style={{ width: 70 }}
              value={r.protocol}
              onChange={(e) => setRule(i, 'protocol', e.target.value)}
            >
              {['tcp', 'udp', 'icmp', '-1'].map((p) => (
                <option key={p} value={p}>
                  {p === '-1' ? 'all' : p}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              style={{ width: 60 }}
              type="number"
              value={r.fromPort}
              onChange={(e) => setRule(i, 'fromPort', Number(e.target.value))}
            />
            <span style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-micro)' }}>-</span>
            <input
              className="form-input"
              style={{ width: 60 }}
              type="number"
              value={r.toPort}
              onChange={(e) => setRule(i, 'toPort', Number(e.target.value))}
            />
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={r.cidr}
              onChange={(e) => setRule(i, 'cidr', e.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              style={{ color: 'var(--fault-500)' }}
              onClick={() => update(rules.filter((_, idx) => idx !== i))}
              title="Remove rule"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6, alignSelf: 'flex-start' }}
          onClick={() =>
            update([...rules, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' }])
          }
        >
          + Add rule
        </button>
      </div>
    </div>
  )
}
