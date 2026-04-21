import React, { useState } from 'react'
import type { AcmParams } from '../../types/create'

interface Props {
  onChange: (p: AcmParams) => void
  showErrors?: boolean
}

export function AcmForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [form, setForm] = useState<Omit<AcmParams, 'resource'>>({
    domainName: '',
    subjectAlternativeNames: [],
    validationMethod: 'DNS'
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

  const domainInvalid = err && !form.domainName.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (domainInvalid ? ' -invalid' : '')}>
        <span className="label">Primary Domain *</span>
        <input
          className="form-input"
          value={form.domainName}
          placeholder="example.com"
          onChange={(e) => update('domainName', e.target.value)}
        />
      </div>

      <div className="form-field">
        <span className="label">Validation Method</span>
        <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
          {(['DNS', 'EMAIL'] as const).map((method) => (
            <label key={method} className="form-checkbox">
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
      </div>

      <div className="form-field">
        <span className="label">Subject Alternative Names</span>
        {sansInput.map((san, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={san}
              placeholder="*.example.com"
              onChange={(e) => {
                const next = [...sansInput]
                next[i] = e.target.value
                updateSans(next)
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const next = sansInput.filter((_, j) => j !== i)
                updateSans(next.length > 0 ? next : [''])
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6 }}
          onClick={() => updateSans([...sansInput, ''])}
        >
          + Add SAN
        </button>
      </div>
    </div>
  )
}
