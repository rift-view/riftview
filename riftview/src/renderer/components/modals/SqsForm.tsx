import { useState } from 'react'
import type { SqsParams } from '../../types/create'

interface Props {
  onChange: (p: SqsParams) => void
  showErrors?: boolean
}

export function SqsForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [fifo, setFifo] = useState(false)
  const [visibilityTimeout, setVisibilityTimeout] = useState('')

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()

  const emit = (n: string, f: boolean, vt: string): void => {
    onChange({
      resource: 'sqs',
      name: n,
      fifo: f || undefined,
      visibilityTimeout: vt ? Number(vt) : undefined
    })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Queue Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-queue"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, fifo, visibilityTimeout)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Visibility Timeout (seconds)</span>
        <input
          className="form-input"
          type="number"
          value={visibilityTimeout}
          placeholder="30"
          min={0}
          max={43200}
          onChange={(e) => {
            setVisibilityTimeout(e.target.value)
            emit(name, fifo, e.target.value)
          }}
        />
      </div>

      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={fifo}
          onChange={(e) => {
            setFifo(e.target.checked)
            emit(name, e.target.checked, visibilityTimeout)
          }}
        />
        FIFO Queue (.fifo suffix added automatically)
      </label>
    </div>
  )
}
