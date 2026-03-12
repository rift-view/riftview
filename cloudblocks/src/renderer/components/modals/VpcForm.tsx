import { useState } from 'react'
import type { VpcParams } from '../../types/create'

interface Props {
  onChange: (params: VpcParams) => void
}

export function VpcForm({ onChange }: Props): JSX.Element {
  const [name,    setName]    = useState('')
  const [cidr,    setCidr]    = useState('10.0.0.0/16')
  const [tenancy, setTenancy] = useState<'default' | 'dedicated'>('default')

  function update(partial: Partial<{ name: string; cidr: string; tenancy: 'default' | 'dedicated' }>): void {
    const next = { name, cidr, tenancy, ...partial }
    setName(next.name); setCidr(next.cidr); setTenancy(next.tenancy)
    onChange({ resource: 'vpc', ...next })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#060d14', border: '1px solid #30363d',
    borderRadius: '3px', padding: '4px 6px', color: '#eee',
    fontFamily: 'monospace', fontSize: '11px', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { color: '#555', fontSize: '9px', marginBottom: '3px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.08em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <label>
        <span style={labelStyle}>Name</span>
        <input style={inputStyle} value={name} onChange={(e) => update({ name: e.target.value })} placeholder="my-vpc" />
      </label>
      <label>
        <span style={labelStyle}>CIDR Block</span>
        <input style={inputStyle} value={cidr} onChange={(e) => update({ cidr: e.target.value })} placeholder="10.0.0.0/16" />
      </label>
      <label>
        <span style={labelStyle}>Tenancy</span>
        <select style={inputStyle} value={tenancy} onChange={(e) => update({ tenancy: e.target.value as 'default' | 'dedicated' })}>
          <option value="default">default</option>
          <option value="dedicated">dedicated</option>
        </select>
      </label>
    </div>
  )
}
