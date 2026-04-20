import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { CreateSubnetParams } from '../../types/create'

interface Props {
  onChange: (p: CreateSubnetParams) => void
  showErrors?: boolean
}

export function SubnetCreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const vpcs = nodes.filter((n) => n.type === 'vpc')

  const [vpcId, setVpcId] = useState('')
  const [cidrBlock, setCidrBlock] = useState('')
  const [availabilityZone, setAvailabilityZone] = useState('')

  const err = showErrors ?? false
  const vpcInvalid = err && !vpcId
  const cidrInvalid = err && !cidrBlock.trim()

  const emit = (v: string, c: string, az: string): void => {
    onChange({
      resource: 'subnet',
      vpcId: v,
      cidrBlock: c,
      availabilityZone: az || undefined
    })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (vpcInvalid ? ' -invalid' : '')}>
        <span className="label">VPC</span>
        <select
          className="form-select"
          value={vpcId}
          onChange={(e) => {
            setVpcId(e.target.value)
            emit(e.target.value, cidrBlock, availabilityZone)
          }}
        >
          <option value="">— select VPC —</option>
          {vpcs.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className={'form-field' + (cidrInvalid ? ' -invalid' : '')}>
        <span className="label">CIDR Block</span>
        <input
          className="form-input"
          value={cidrBlock}
          placeholder="10.0.1.0/24"
          onChange={(e) => {
            setCidrBlock(e.target.value)
            emit(vpcId, e.target.value, availabilityZone)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Availability Zone</span>
        <input
          className="form-input"
          value={availabilityZone}
          placeholder="us-east-1a"
          onChange={(e) => {
            setAvailabilityZone(e.target.value)
            emit(vpcId, cidrBlock, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
