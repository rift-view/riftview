import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { CreateSubnetParams } from '../../types/create'

interface Props {
  onChange: (p: CreateSubnetParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--cb-bg-panel)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--cb-text-primary)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const,
})

const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--cb-text-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8,
}

export function SubnetCreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs  = nodes.filter((n) => n.type === 'vpc')

  const [vpcId,             setVpcId]             = useState('')
  const [cidrBlock,         setCidrBlock]         = useState('')
  const [availabilityZone,  setAvailabilityZone]  = useState('')

  const err = showErrors ?? false

  const emit = (v: string, c: string, az: string): void => {
    onChange({
      resource: 'subnet',
      vpcId: v,
      cidrBlock: c,
      availabilityZone: az || undefined,
    })
  }

  return (
    <div>
      <div style={lbl}>VPC *</div>
      <select
        style={inp(err && !vpcId)}
        value={vpcId}
        onChange={(e) => { setVpcId(e.target.value); emit(e.target.value, cidrBlock, availabilityZone) }}
      >
        <option value="">— select VPC —</option>
        {vpcs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>

      <div style={lbl}>CIDR Block *</div>
      <input
        style={inp(err && !cidrBlock.trim())}
        value={cidrBlock}
        placeholder="10.0.1.0/24"
        onChange={(e) => { setCidrBlock(e.target.value); emit(vpcId, e.target.value, availabilityZone) }}
      />

      <div style={lbl}>Availability Zone</div>
      <input
        style={inp(false)}
        value={availabilityZone}
        placeholder="us-east-1a"
        onChange={(e) => { setAvailabilityZone(e.target.value); emit(vpcId, cidrBlock, e.target.value) }}
      />
    </div>
  )
}
