import React, { useState } from 'react'
import type { AcmParams } from '../../types/create'

interface Props { onChange: (p: AcmParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const btnSm: React.CSSProperties = { background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '2px 6px', color: 'var(--cb-text-muted)', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }

export function AcmForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [form, setForm] = useState<Omit<AcmParams, 'resource'>>({
    domainName: '',
    subjectAlternativeNames: [],
    validationMethod: 'DNS',
  })
  const [sansInput, setSansInput] = useState<string[]>([''])

  const err = showErrors ?? false

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]): void => {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange({ resource: 'acm', ...next })
  }

  const updateSans = (newInputs: string[]): void => {
    setSansInput(newInputs)
    const filtered = newInputs.filter((s) => s.trim() !== '')
    update('subjectAlternativeNames', filtered)
  }

  return (
    <div>
      <div style={lbl}>Primary Domain *</div>
      <input
        style={inp(err && !form.domainName.trim())}
        value={form.domainName}
        placeholder="example.com"
        onChange={(e) => update('domainName', e.target.value)}
      />

      <div style={lbl}>Validation Method</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        {(['DNS', 'EMAIL'] as const).map((method) => (
          <label key={method} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--cb-text-secondary)', cursor: 'pointer' }}>
            <input
              type="radio"
              name="validationMethod"
              value={method}
              checked={form.validationMethod === method}
              onChange={() => update('validationMethod', method)}
            />
            {method}
          </label>
        ))}
      </div>

      <div style={lbl}>Subject Alternative Names</div>
      {sansInput.map((san, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <input
            style={{ ...inp(false), flex: 1 }}
            value={san}
            placeholder="*.example.com"
            onChange={(e) => {
              const next = [...sansInput]
              next[i] = e.target.value
              updateSans(next)
            }}
          />
          <button
            style={btnSm}
            onClick={() => {
              const next = sansInput.filter((_, j) => j !== i)
              updateSans(next.length > 0 ? next : [''])
            }}
          >✕</button>
        </div>
      ))}
      <button
        style={{ ...btnSm, marginTop: 6 }}
        onClick={() => updateSans([...sansInput, ''])}
      >+ Add SAN</button>
    </div>
  )
}
