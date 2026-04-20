import { useState } from 'react'
import type { EcrParams } from '../../types/create'

interface Props {
  onChange: (p: EcrParams) => void
  showErrors?: boolean
}

export function EcrForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Repository Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-app/service"
          onChange={(e) => {
            setName(e.target.value)
            onChange({ resource: 'ecr', name: e.target.value })
          }}
        />
      </div>
    </div>
  )
}
