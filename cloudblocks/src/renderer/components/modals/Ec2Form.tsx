import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { Ec2Params } from '../../types/create'

const INSTANCE_TYPES = ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm5.large', 'c5.large']

interface Props {
  onChange: (params: Ec2Params) => void
  showErrors?: boolean
}

function fieldStyle(value: string, showErrors: boolean): React.CSSProperties {
  return {
    width: '100%',
    background: 'var(--cb-bg-panel)',
    border: `1px solid ${showErrors && !value.trim() ? '#ff5f57' : 'var(--cb-border)'}`,
    borderRadius: 3,
    padding: '3px 6px',
    color: 'var(--cb-text-primary)',
    fontFamily: 'monospace',
    fontSize: 10,
    boxSizing: 'border-box' as const,
  }
}

export function Ec2Form({ onChange, showErrors = false }: Props): React.JSX.Element {
  const nodes    = useCloudStore((s) => s.nodes)
  const keyPairs = useCloudStore((s) => s.keyPairs)
  const vpcs    = nodes.filter((n) => n.type === 'vpc')
  const subnets = nodes.filter((n) => n.type === 'subnet')
  const sgs     = nodes.filter((n) => n.type === 'security-group')

  const [name,             setName]             = useState('')
  const [amiId,            setAmiId]            = useState('')
  const [instanceType,     setInstanceType]     = useState('t3.micro')
  const [keyName,          setKeyName]          = useState('')
  const [selectedVpc,      setSelectedVpc]      = useState('')
  const [subnetId,         setSubnetId]         = useState('')
  const [securityGroupIds, setSecurityGroupIds] = useState<string[]>([])

  const filteredSubnets = subnets.filter((s) => !selectedVpc || s.parentId === selectedVpc)

  function update(partial: Partial<{
    name: string; amiId: string; instanceType: string; keyName: string
    subnetId: string; securityGroupIds: string[]
  }>): void {
    const next = { name, amiId, instanceType, keyName, subnetId, securityGroupIds, ...partial }
    setName(next.name); setAmiId(next.amiId); setInstanceType(next.instanceType)
    setKeyName(next.keyName); setSubnetId(next.subnetId); setSecurityGroupIds(next.securityGroupIds)
    onChange({ resource: 'ec2', ...next })
  }

  function toggleSg(id: string): void {
    const next = securityGroupIds.includes(id)
      ? securityGroupIds.filter((s) => s !== id)
      : [...securityGroupIds, id]
    update({ securityGroupIds: next })
  }

  const labelStyle: React.CSSProperties = { color: 'var(--cb-text-muted)', fontSize: '9px', marginBottom: '3px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }
  const nonRequiredStyle: React.CSSProperties = fieldStyle('_nonempty_', false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label><span style={labelStyle}>Name</span>
        <input style={fieldStyle(name, showErrors)} value={name} onChange={(e) => update({ name: e.target.value })} placeholder="web-server" /></label>
      <label><span style={labelStyle}>AMI ID</span>
        <input style={fieldStyle(amiId, showErrors)} value={amiId} onChange={(e) => update({ amiId: e.target.value })} placeholder="ami-0abcdef1234567890" /></label>
      <label><span style={labelStyle}>Instance Type</span>
        <select style={fieldStyle(instanceType, showErrors)} value={instanceType} onChange={(e) => update({ instanceType: e.target.value })}>
          {INSTANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select></label>
      <label><span style={labelStyle}>Key Pair</span>
        <select
          value={keyName}
          onChange={e => update({ keyName: e.target.value })}
          style={nonRequiredStyle}
        >
          <option value="">— select key pair —</option>
          {keyPairs.map(kp => <option key={kp} value={kp}>{kp}</option>)}
        </select></label>
      <label><span style={labelStyle}>VPC (for subnet filtering)</span>
        <select style={nonRequiredStyle} value={selectedVpc} onChange={(e) => setSelectedVpc(e.target.value)}>
          <option value="">— select VPC —</option>
          {vpcs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>
      <label><span style={labelStyle}>Subnet</span>
        <select style={nonRequiredStyle} value={subnetId} onChange={(e) => update({ subnetId: e.target.value })}>
          <option value="">— select subnet —</option>
          {filteredSubnets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select></label>
      <div><span style={labelStyle}>Security Groups</span>
        {sgs.length === 0 ? (
          <div style={{ color: 'var(--cb-text-muted)', fontSize: '10px' }}>No security groups found</div>
        ) : sgs.map((sg) => (
          <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', cursor: 'pointer' }}>
            <input type="checkbox" checked={securityGroupIds.includes(sg.id)} onChange={() => toggleSg(sg.id)} />
            <span style={{ color: 'var(--cb-text-secondary)', fontSize: '10px', fontFamily: 'monospace' }}>{sg.label}</span>
          </label>
        ))}</div>
    </div>
  )
}
