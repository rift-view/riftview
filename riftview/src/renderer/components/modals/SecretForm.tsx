import { useState } from 'react'
import type { SecretParams } from '../../types/create'

interface Props {
  onChange: (p: SecretParams) => void
  showErrors?: boolean
}

export function SecretForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()
  const valueInvalid = err && !value.trim()

  const emit = (n: string, v: string): void => {
    onChange({ resource: 'secret', name: n, value: v })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Secret Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-app/db-password"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, value)
          }}
        />
      </div>

      <div className={'form-field' + (valueInvalid ? ' -invalid' : '')}>
        <span className="label">Secret Value</span>
        <input
          className="form-input"
          type="password"
          value={value}
          placeholder="super-secret-value"
          onChange={(e) => {
            setValue(e.target.value)
            emit(name, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
