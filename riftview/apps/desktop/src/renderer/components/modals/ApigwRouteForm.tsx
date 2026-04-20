import { useState } from 'react'
import type { ApigwRouteParams } from '../../types/create'

interface Props {
  apiId: string
  onChange: (p: ApigwRouteParams) => void
  showErrors?: boolean
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY'] as const

export function ApigwRouteForm({ apiId, onChange, showErrors }: Props): React.JSX.Element {
  const [method, setMethod] = useState<string>('GET')
  const [path, setPath] = useState('')

  const err = showErrors ?? false

  const emit = (m: string, p: string): void => {
    onChange({ resource: 'apigw-route', apiId, method: m, path: p })
  }

  const pathError = err && (!path.trim() || !path.startsWith('/'))

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">API ID</span>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--fg-muted)',
            padding: '2px 0'
          }}
        >
          {apiId}
        </div>
      </div>

      <div className="form-field">
        <span className="label">Method</span>
        <select
          className="form-select"
          value={method}
          onChange={(e) => {
            setMethod(e.target.value)
            emit(e.target.value, path)
          }}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className={'form-field' + (pathError ? ' -invalid' : '')}>
        <span className="label">Path</span>
        <input
          className="form-input"
          value={path}
          placeholder="/users"
          onChange={(e) => {
            setPath(e.target.value)
            emit(method, e.target.value)
          }}
        />
        {pathError && <div className="form-error">Path must start with /</div>}
      </div>
    </div>
  )
}
