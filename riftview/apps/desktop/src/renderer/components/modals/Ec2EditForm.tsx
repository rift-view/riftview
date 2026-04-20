import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { Ec2EditParams } from '../../types/edit'
import { useCloudStore } from '../../store/cloud'

interface Props {
  node: CloudNode
  onChange: (p: Ec2EditParams) => void
}

export default function Ec2EditForm({ node, onChange }: Props): React.JSX.Element {
  const nodes = useCloudStore((s) => s.nodes)
  const [name, setName] = useState((node.metadata.name as string) ?? node.label)
  const [instType, setInstType] = useState((node.metadata.instanceType as string) ?? 't3.micro')
  const [sgIds, setSgIds] = useState<string[]>((node.metadata.securityGroupIds as string[]) ?? [])

  const sgs = nodes.filter((n) => n.type === 'security-group')

  const emit = (overrides: Partial<Ec2EditParams>): void =>
    onChange({
      resource: 'ec2',
      name,
      instanceType: instType,
      securityGroupIds: sgIds,
      ...overrides
    })

  const toggleSg = (id: string): void => {
    const next = sgIds.includes(id) ? sgIds.filter((x) => x !== id) : [...sgIds, id]
    setSgIds(next)
    emit({ securityGroupIds: next })
  }

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            emit({ name: e.target.value })
          }}
        />
      </div>
      <div className="form-field">
        <span className="label">Instance type</span>
        <select
          className="form-select"
          value={instType}
          onChange={(e) => {
            setInstType(e.target.value)
            emit({ instanceType: e.target.value })
          }}
        >
          {[
            't3.micro',
            't3.small',
            't3.medium',
            't3.large',
            'm5.large',
            'm5.xlarge',
            'c5.large'
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      {sgs.length > 0 && (
        <div className="form-field">
          <span className="label">Security groups</span>
          {sgs.map((sg) => (
            <label key={sg.id} className="form-checkbox">
              <input
                type="checkbox"
                checked={sgIds.includes(sg.id)}
                onChange={() => toggleSg(sg.id)}
              />
              {sg.label} ({sg.id})
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
