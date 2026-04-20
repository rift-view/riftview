import { useState } from 'react'
import { useCloudStore } from '../../store/cloud'
import type { Ec2Params } from '../../types/create'

const INSTANCE_TYPES = ['t3.micro', 't3.small', 't3.medium', 't3.large', 'm5.large', 'c5.large']

interface Props {
  onChange: (params: Ec2Params) => void
  showErrors?: boolean
}

export function Ec2Form({ onChange, showErrors = false }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const keyPairs = useCloudStore((s) => s.keyPairs)
  const profile = useCloudStore((s) => s.profile)
  const vpcs = nodes.filter((n) => n.type === 'vpc')
  const subnets = nodes.filter((n) => n.type === 'subnet')
  const sgs = nodes.filter((n) => n.type === 'security-group')

  const isLocal = !!profile.endpoint
  const [name, setName] = useState('')
  const [amiId, setAmiId] = useState('')
  const [instanceType, setInstanceType] = useState('t3.micro')
  const [keyName, setKeyName] = useState('')
  const [selectedVpc, setSelectedVpc] = useState('')
  const [subnetId, setSubnetId] = useState('')
  const [securityGroupIds, setSecurityGroupIds] = useState<string[]>([])

  const filteredSubnets = subnets.filter((s) => !selectedVpc || s.parentId === selectedVpc)

  function update(
    partial: Partial<{
      name: string
      amiId: string
      instanceType: string
      keyName: string
      subnetId: string
      securityGroupIds: string[]
    }>
  ): void {
    const next = { name, amiId, instanceType, keyName, subnetId, securityGroupIds, ...partial }
    setName(next.name)
    setAmiId(next.amiId)
    setInstanceType(next.instanceType)
    setKeyName(next.keyName)
    setSubnetId(next.subnetId)
    setSecurityGroupIds(next.securityGroupIds)
    onChange({ resource: 'ec2', ...next })
  }

  function toggleSg(id: string): void {
    const next = securityGroupIds.includes(id)
      ? securityGroupIds.filter((s) => s !== id)
      : [...securityGroupIds, id]
    update({ securityGroupIds: next })
  }

  const nameInvalid = showErrors && !name.trim()
  const amiInvalid = showErrors && !amiId.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="web-server"
        />
      </div>
      <div className={'form-field' + (amiInvalid ? ' -invalid' : '')}>
        <span className="label">AMI ID</span>
        <input
          className="form-input"
          value={amiId}
          onChange={(e) => update({ amiId: e.target.value })}
          placeholder={
            isLocal ? 'ami-xxxxxxxx  (must exist in LocalStack)' : 'ami-0abcdef1234567890'
          }
        />
      </div>
      <div className="form-field">
        <span className="label">Instance Type</span>
        <select
          className="form-select"
          value={instanceType}
          onChange={(e) => update({ instanceType: e.target.value })}
        >
          {INSTANCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <span className="label">Key Pair</span>
        <select
          className="form-select"
          value={keyName}
          onChange={(e) => update({ keyName: e.target.value })}
        >
          <option value="">— select key pair —</option>
          {keyPairs.map((kp) => (
            <option key={kp} value={kp}>
              {kp}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <span className="label">VPC (for subnet filtering)</span>
        <select
          className="form-select"
          value={selectedVpc}
          onChange={(e) => setSelectedVpc(e.target.value)}
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
        <span className="label">Subnet</span>
        <select
          className="form-select"
          value={subnetId}
          onChange={(e) => update({ subnetId: e.target.value })}
        >
          <option value="">— select subnet —</option>
          {filteredSubnets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <span className="label">Security Groups</span>
        {sgs.length === 0 ? (
          <div className="form-helper">No security groups found</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sgs.map((sg) => (
              <label key={sg.id} className="form-checkbox">
                <input
                  type="checkbox"
                  checked={securityGroupIds.includes(sg.id)}
                  onChange={() => toggleSg(sg.id)}
                />
                {sg.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
