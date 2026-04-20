import { useState } from 'react'
import type { SnsParams } from '../../types/create'

interface Props {
  onChange: (p: SnsParams) => void
  showErrors?: boolean
}

export function SnsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [fifo, setFifo] = useState(false)

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()

  const emit = (n: string, f: boolean): void => {
    onChange({ resource: 'sns', name: n, fifo: f || undefined })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Topic Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-topic"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, fifo)
          }}
        />
      </div>

      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={fifo}
          onChange={(e) => {
            setFifo(e.target.checked)
            emit(name, e.target.checked)
          }}
        />
        FIFO Topic (.fifo suffix added automatically)
      </label>
    </div>
  )
}
