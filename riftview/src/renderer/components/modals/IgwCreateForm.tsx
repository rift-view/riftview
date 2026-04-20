import { useState } from 'react'
import type { CreateIgwParams } from '../../types/create'

interface Props {
  onChange: (p: CreateIgwParams) => void
  showErrors?: boolean
}

export function IgwCreateForm({ onChange }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const emit = (n: string): void => {
    onChange({ resource: 'igw', name: n || undefined })
  }

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Name Tag</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-igw"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value)
          }}
        />
      </div>
    </div>
  )
}
