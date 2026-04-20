import { useState } from 'react'
import type { SfnParams } from '../../types/create'

interface Props {
  onChange: (p: SfnParams) => void
  showErrors?: boolean
}

const BLANK_DEFINITION = JSON.stringify(
  {
    Comment: 'My state machine',
    StartAt: 'HelloWorld',
    States: { HelloWorld: { Type: 'Pass', End: true } }
  },
  null,
  2
)

export function SfnForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [type, setType] = useState<'STANDARD' | 'EXPRESS'>('STANDARD')
  const [roleArn, setRoleArn] = useState('')
  const [definition, setDefinition] = useState(BLANK_DEFINITION)

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()
  const roleInvalid = err && !roleArn.trim()
  const defInvalid = err && !definition.trim()

  const emit = (n: string, t: 'STANDARD' | 'EXPRESS', r: string, d: string): void => {
    onChange({ resource: 'sfn', name: n, type: t, roleArn: r, definition: d })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">State Machine Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="my-state-machine"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, type, roleArn, definition)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Type</span>
        <select
          className="form-select"
          value={type}
          onChange={(e) => {
            setType(e.target.value as 'STANDARD' | 'EXPRESS')
            emit(name, e.target.value as 'STANDARD' | 'EXPRESS', roleArn, definition)
          }}
        >
          <option value="STANDARD">STANDARD</option>
          <option value="EXPRESS">EXPRESS</option>
        </select>
      </div>

      <div className={'form-field' + (roleInvalid ? ' -invalid' : '')}>
        <span className="label">Role ARN</span>
        <input
          className="form-input"
          value={roleArn}
          placeholder="arn:aws:iam::123456789012:role/StepFunctionsRole"
          onChange={(e) => {
            setRoleArn(e.target.value)
            emit(name, type, e.target.value, definition)
          }}
        />
      </div>

      <div className={'form-field' + (defInvalid ? ' -invalid' : '')}>
        <span className="label">Definition (ASL JSON)</span>
        <textarea
          className="form-textarea"
          style={{ minHeight: 80 }}
          value={definition}
          onChange={(e) => {
            setDefinition(e.target.value)
            emit(name, type, roleArn, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
