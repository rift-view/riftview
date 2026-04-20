import { useState } from 'react'
import type { R53ZoneParams } from '../../types/create'

interface Props {
  onChange: (p: R53ZoneParams) => void
  showErrors?: boolean
}

export function R53CreateForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [domainName, setDomainName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  const err = showErrors ?? false
  const domainInvalid = err && !domainName.trim()

  const emit = (d: string, p: boolean): void => {
    onChange({ resource: 'r53-zone', domainName: d, isPrivate: p })
  }

  return (
    <div className="form-group">
      <div className={'form-field' + (domainInvalid ? ' -invalid' : '')}>
        <span className="label">Domain Name</span>
        <input
          className="form-input"
          value={domainName}
          placeholder="example.com"
          onChange={(e) => {
            setDomainName(e.target.value)
            emit(e.target.value, isPrivate)
          }}
        />
      </div>

      <label className="form-checkbox">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => {
            setIsPrivate(e.target.checked)
            emit(domainName, e.target.checked)
          }}
        />
        Private Hosted Zone
      </label>
    </div>
  )
}
