import { useState } from 'react'
import type { ApigwParams } from '../../types/create'

interface Props {
  onChange: (p: ApigwParams) => void
  showErrors?: boolean
}

export function ApigwForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [corsInputs, setCorsInputs] = useState<string[]>([''])

  const err = showErrors ?? false

  const emit = (nextName: string, nextCors: string[]): void => {
    const corsOrigins = nextCors.filter((s) => s.trim() !== '')
    onChange({ resource: 'apigw', name: nextName, corsOrigins })
  }

  const updateCors = (newInputs: string[]): void => {
    setCorsInputs(newInputs)
    emit(name, newInputs)
  }

  const nameInvalid = err && !name.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">API Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-http-api"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, corsInputs)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">CORS Origins</span>
        {corsInputs.map((origin, i) => (
          <div key={i} style={{ display: 'flex', gap: 4, marginTop: i === 0 ? 0 : 4 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={origin}
              placeholder="https://example.com"
              onChange={(e) => {
                const next = [...corsInputs]
                next[i] = e.target.value
                updateCors(next)
              }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => {
                const next = corsInputs.filter((_, j) => j !== i)
                updateCors(next.length > 0 ? next : [''])
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ marginTop: 6, alignSelf: 'flex-start' }}
          onClick={() => updateCors([...corsInputs, ''])}
        >
          + Add Origin
        </button>
      </div>
    </div>
  )
}
