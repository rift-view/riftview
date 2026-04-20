import { useState } from 'react'
import type { CreateSsmParamParams } from '../../types/create'

interface Props {
  onChange: (p: CreateSsmParamParams) => void
  showErrors?: boolean
}

export function SsmCreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [paramType, setParamType] = useState<'String' | 'StringList'>('String')
  const [description, setDescription] = useState('')

  const err = showErrors ?? false
  const nameInvalid = err && !name.trim()
  const valueInvalid = err && !value.trim()

  const emit = (n: string, v: string, t: 'String' | 'StringList', d: string): void => {
    onChange({
      resource: 'ssm-param',
      name: n,
      value: v,
      paramType: t,
      description: d || undefined
    })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (nameInvalid ? ' -invalid' : '')}>
        <span className="label">Parameter Name</span>
        <input
          className="form-input"
          value={name}
          placeholder="/my/app/config"
          onChange={(e) => {
            setName(e.target.value)
            emit(e.target.value, value, paramType, description)
          }}
        />
      </div>

      <div className={'form-field' + (valueInvalid ? ' -invalid' : '')}>
        <span className="label">Value</span>
        <input
          className="form-input"
          value={value}
          placeholder="parameter value"
          onChange={(e) => {
            setValue(e.target.value)
            emit(name, e.target.value, paramType, description)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Type</span>
        <select
          className="form-select"
          value={paramType}
          onChange={(e) => {
            const t = e.target.value as 'String' | 'StringList'
            setParamType(t)
            emit(name, value, t, description)
          }}
        >
          <option value="String">String</option>
          <option value="StringList">StringList</option>
        </select>
      </div>

      <div className="form-field">
        <span className="label">Description</span>
        <input
          className="form-input"
          value={description}
          placeholder="Optional description"
          onChange={(e) => {
            setDescription(e.target.value)
            emit(name, value, paramType, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
