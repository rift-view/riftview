import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { SgParams } from '../../types/create'

type Rule = SgParams['inboundRules'][number]

interface Props {
  onChange: (params: SgParams) => void
  showErrors?: boolean
}

const BLANK_RULE: Rule = { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }

export function SgForm({ onChange, showErrors = false }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs = nodes.filter((n) => n.type === 'aws:vpc')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [vpcId, setVpcId] = useState('')
  const [rules, setRules] = useState<Rule[]>([{ ...BLANK_RULE }])

  function updateTop(partial: Partial<{ name: string; description: string; vpcId: string }>): void {
    const next = { name, description, vpcId, ...partial }
    setName(next.name)
    setDescription(next.description)
    setVpcId(next.vpcId)
    onChange({ resource: 'sg', inboundRules: rules, ...next })
  }

  function updateRule(i: number, partial: Partial<Rule>): void {
    const next = rules.map((r, idx) => (idx === i ? { ...r, ...partial } : r))
    setRules(next)
    onChange({ resource: 'sg', name, description, vpcId, inboundRules: next })
  }

  function addRule(): void {
    const next = [...rules, { ...BLANK_RULE }]
    setRules(next)
    onChange({ resource: 'sg', name, description, vpcId, inboundRules: next })
  }

  function removeRule(i: number): void {
    const next = rules.filter((_, idx) => idx !== i)
    setRules(next)
    onChange({ resource: 'sg', name, description, vpcId, inboundRules: next })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (showErrors && !name.trim() ? ' -invalid' : '')}>
        <span className="label">Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => updateTop({ name: e.target.value })}
          placeholder="web-sg"
        />
      </div>
      <div className={'form-field' + (showErrors && !description.trim() ? ' -invalid' : '')}>
        <span className="label">Description</span>
        <input
          className="form-input"
          value={description}
          onChange={(e) => updateTop({ description: e.target.value })}
          placeholder="Web tier security group"
        />
      </div>
      <div className={'form-field' + (showErrors && !vpcId.trim() ? ' -invalid' : '')}>
        <span className="label">VPC</span>
        <select
          className="form-select"
          value={vpcId}
          onChange={(e) => updateTop({ vpcId: e.target.value })}
        >
          <option value="">— select VPC —</option>
          {vpcs.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <span className="label">Inbound Rules</span>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: 80 }}
              value={rule.protocol}
              onChange={(e) => updateRule(i, { protocol: e.target.value as Rule['protocol'] })}
            >
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="icmp">ICMP</option>
              <option value="-1">All</option>
            </select>
            <input
              className="form-input"
              style={{ width: 64 }}
              type="number"
              value={rule.fromPort}
              onChange={(e) => updateRule(i, { fromPort: Number(e.target.value) })}
              placeholder="from"
            />
            <span style={{ color: 'var(--fg-muted)', fontSize: 10 }}>–</span>
            <input
              className="form-input"
              style={{ width: 64 }}
              type="number"
              value={rule.toPort}
              onChange={(e) => updateRule(i, { toPort: Number(e.target.value) })}
              placeholder="to"
            />
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={rule.cidr}
              onChange={(e) => updateRule(i, { cidr: e.target.value })}
              placeholder="0.0.0.0/0"
            />
            <button
              type="button"
              onClick={() => removeRule(i)}
              className="btn btn-sm btn-ghost"
              style={{ padding: '2px 6px' }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRule}
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6 }}
        >
          + Add Rule
        </button>
      </div>
    </div>
  )
}
