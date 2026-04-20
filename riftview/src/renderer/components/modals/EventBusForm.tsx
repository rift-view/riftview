import { useState } from 'react'
import type { EventBusParams } from '../../types/create'

interface Props {
  onChange: (p: EventBusParams) => void
  showErrors?: boolean
}

export function EventBusForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Event Bus Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-event-bus"
          onChange={(e) => {
            setName(e.target.value)
            onChange({ resource: 'eventbridge-bus', name: e.target.value })
          }}
        />
      </div>
    </div>
  )
}
