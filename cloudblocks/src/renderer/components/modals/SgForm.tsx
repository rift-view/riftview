import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { SgParams } from '../../types/create'

type Rule = SgParams['inboundRules'][number]

interface Props {
  onChange: (params: SgParams) => void
}

const BLANK_RULE: Rule = { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' }

export function SgForm({ onChange }: Props): JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs  = nodes.filter((n) => n.type === 'vpc')

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [vpcId,       setVpcId]       = useState('')
  const [rules,       setRules]       = useState<Rule[]>([{ ...BLANK_RULE }])

  function updateTop(partial: Partial<{ name: string; description: string; vpcId: string }>): void {
    const next = { name, description, vpcId, ...partial }
    setName(next.name); setDescription(next.description); setVpcId(next.vpcId)
    onChange({ resource: 'sg', inboundRules: rules, ...next })
  }

  function updateRule(i: number, partial: Partial<Rule>): void {
    const next = rules.map((r, idx) => idx === i ? { ...r, ...partial } : r)
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

  const inputStyle: React.CSSProperties = {
    background: '#060d14', border: '1px solid #30363d', borderRadius: '3px',
    padding: '4px 6px', color: '#eee', fontFamily: 'monospace', fontSize: '11px',
  }
  const labelStyle: React.CSSProperties = { color: '#555', fontSize: '9px', marginBottom: '3px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label><span style={labelStyle}>Name</span>
        <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={name}
          onChange={(e) => updateTop({ name: e.target.value })} placeholder="web-sg" /></label>
      <label><span style={labelStyle}>Description</span>
        <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={description}
          onChange={(e) => updateTop({ description: e.target.value })} placeholder="Web tier security group" /></label>
      <label><span style={labelStyle}>VPC</span>
        <select style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} value={vpcId}
          onChange={(e) => updateTop({ vpcId: e.target.value })}>
          <option value="">— select VPC —</option>
          {vpcs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>
      <div>
        <span style={labelStyle}>Inbound Rules</span>
        {rules.map((rule, i) => (
          <div key={i} style={{ display: 'flex', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
            <select style={{ ...inputStyle, width: '70px' }} value={rule.protocol}
              onChange={(e) => updateRule(i, { protocol: e.target.value as Rule['protocol'] })}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
              <option value="-1">All</option>
            </select>
            <input style={{ ...inputStyle, width: '50px' }} type="number" value={rule.fromPort}
              onChange={(e) => updateRule(i, { fromPort: Number(e.target.value) })} placeholder="from" />
            <span style={{ color: '#555', fontSize: '10px' }}>–</span>
            <input style={{ ...inputStyle, width: '50px' }} type="number" value={rule.toPort}
              onChange={(e) => updateRule(i, { toPort: Number(e.target.value) })} placeholder="to" />
            <input style={{ ...inputStyle, flex: 1 }} value={rule.cidr}
              onChange={(e) => updateRule(i, { cidr: e.target.value })} placeholder="0.0.0.0/0" />
            <button onClick={() => removeRule(i)}
              style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: '12px' }}>✕</button>
          </div>
        ))}
        <button onClick={addRule}
          style={{ background: '#1a2332', border: '1px solid #30363d', borderRadius: '3px', color: '#aaa', cursor: 'pointer', fontSize: '10px', padding: '3px 8px', fontFamily: 'monospace' }}>
          + Add Rule
        </button>
      </div>
    </div>
  )
}
