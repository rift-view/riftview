import React, { useState } from 'react'
import type { R53ZoneParams } from '../../types/create'

interface Props { onChange: (p: R53ZoneParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--cb-text-secondary)', fontFamily: 'monospace', fontSize: 10 }

export function R53CreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [domainName, setDomainName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const err = showErrors ?? false

  const emit = (d: string, p: boolean): void => {
    onChange({ resource: 'r53-zone', domainName: d, isPrivate: p })
  }

  return (
    <div>
      <div style={lbl}>Domain Name *</div>
      <input
        style={inp(err && !domainName.trim())}
        value={domainName}
        placeholder="example.com"
        onChange={(e) => { setDomainName(e.target.value); emit(e.target.value, isPrivate) }}
      />

      <label style={checkRow}>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => { setIsPrivate(e.target.checked); emit(domainName, e.target.checked) }}
        />
        Private Hosted Zone
      </label>
    </div>
  )
}
