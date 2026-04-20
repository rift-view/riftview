import { useState } from 'react'
import type { VpcParams } from '../../types/create'

interface Props {
  onChange: (params: VpcParams) => void
  showErrors?: boolean
}

export function VpcForm({ onChange, showErrors = false }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [cidr, setCidr] = useState('10.0.0.0/16')
  const [tenancy, setTenancy] = useState<'default' | 'dedicated'>('default')

  function update(
    partial: Partial<{ name: string; cidr: string; tenancy: 'default' | 'dedicated' }>
  ): void {
    const next = { name, cidr, tenancy, ...partial }
    setName(next.name)
    setCidr(next.cidr)
    setTenancy(next.tenancy)
    onChange({ resource: 'vpc', ...next })
  }

  const nameInvalid = showErrors && !name.trim()
  const cidrInvalid = showErrors && !cidr.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="my-vpc"
        />
      </div>
      <div className={'form-field' + (cidrInvalid ? ' -invalid' : '')}>
        <span className="label">CIDR Block</span>
        <input
          className="form-input"
          value={cidr}
          onChange={(e) => update({ cidr: e.target.value })}
          placeholder="10.0.0.0/16"
        />
      </div>
      <div className="form-field">
        <span className="label">Tenancy</span>
        <select
          className="form-select"
          value={tenancy}
          onChange={(e) => update({ tenancy: e.target.value as 'default' | 'dedicated' })}
        >
          <option value="default">default</option>
          <option value="dedicated">dedicated</option>
        </select>
      </div>
    </div>
  )
}
