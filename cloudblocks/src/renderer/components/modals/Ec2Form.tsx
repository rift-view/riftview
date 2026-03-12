import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { Ec2Params } from '../../types/create'

const INSTANCE_TYPES = ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm5.large', 'c5.large']

interface Props {
  onChange: (params: Ec2Params) => void
}

export function Ec2Form({ onChange }: Props): JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
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

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#060d14', border: '1px solid #30363d',
    borderRadius: '3px', padding: '4px 6px', color: '#eee',
    fontFamily: 'monospace', fontSize: '11px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { color: '#555', fontSize: '9px', marginBottom: '3px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label><span style={labelStyle}>Name</span>
        <input style={inputStyle} value={name} onChange={(e) => update({ name: e.target.value })} placeholder="web-server" /></label>
      <label><span style={labelStyle}>AMI ID</span>
        <input style={inputStyle} value={amiId} onChange={(e) => update({ amiId: e.target.value })} placeholder="ami-0abcdef1234567890" /></label>
      <label><span style={labelStyle}>Instance Type</span>
        <select style={inputStyle} value={instanceType} onChange={(e) => update({ instanceType: e.target.value })}>
          {INSTANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select></label>
      <label><span style={labelStyle}>Key Pair Name (free text — M3 will add dropdown)</span>
        <input style={inputStyle} value={keyName} onChange={(e) => update({ keyName: e.target.value })} placeholder="my-key-pair" /></label>
      <label><span style={labelStyle}>VPC (for subnet filtering)</span>
        <select style={inputStyle} value={selectedVpc} onChange={(e) => setSelectedVpc(e.target.value)}>
          <option value="">— select VPC —</option>
          {vpcs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select></label>
      <label><span style={labelStyle}>Subnet</span>
        <select style={inputStyle} value={subnetId} onChange={(e) => update({ subnetId: e.target.value })}>
          <option value="">— select subnet —</option>
          {filteredSubnets.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select></label>
      <div><span style={labelStyle}>Security Groups</span>
        {sgs.length === 0 ? (
          <div style={{ color: '#555', fontSize: '10px' }}>No security groups found</div>
        ) : sgs.map((sg) => (
          <label key={sg.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', cursor: 'pointer' }}>
            <input type="checkbox" checked={securityGroupIds.includes(sg.id)} onChange={() => toggleSg(sg.id)} />
            <span style={{ color: '#aaa', fontSize: '10px', fontFamily: 'monospace' }}>{sg.label}</span>
          </label>
        ))}</div>
    </div>
  )
}
