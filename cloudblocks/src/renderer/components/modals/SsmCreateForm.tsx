import React, { useState } from 'react'
import type { CreateSsmParamParams } from '../../types/create'

interface Props { onChange: (p: CreateSsmParamParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const sel: React.CSSProperties = {
  width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
}
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export function SsmCreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [paramType, setParamType] = useState<'String' | 'StringList'>('String')
  const [description, setDescription] = useState('')

  const err = showErrors ?? false

  const emit = (n: string, v: string, t: 'String' | 'StringList', d: string): void => {
    onChange({ resource: 'ssm-param', name: n, value: v, paramType: t, description: d || undefined })
  }

  return (
    <div>
      <div style={lbl}>Parameter Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="/my/app/config"
        onChange={(e) => { setName(e.target.value); emit(e.target.value, value, paramType, description) }}
      />

      <div style={lbl}>Value *</div>
      <input
        style={inp(err && !value.trim())}
        value={value}
        placeholder="parameter value"
        onChange={(e) => { setValue(e.target.value); emit(name, e.target.value, paramType, description) }}
      />

      <div style={lbl}>Type</div>
      <select
        style={sel}
        value={paramType}
        onChange={(e) => { const t = e.target.value as 'String' | 'StringList'; setParamType(t); emit(name, value, t, description) }}
      >
        <option value="String">String</option>
        <option value="StringList">StringList</option>
      </select>

      <div style={lbl}>Description</div>
      <input
        style={inp(false)}
        value={description}
        placeholder="Optional description"
        onChange={(e) => { setDescription(e.target.value); emit(name, value, paramType, e.target.value) }}
      />
    </div>
  )
}
