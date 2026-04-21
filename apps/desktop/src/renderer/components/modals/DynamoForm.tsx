import { useState } from 'react'
import type { DynamoParams } from '../../types/create'

interface Props {
  onChange: (p: DynamoParams) => void
  showErrors?: boolean
}

export function DynamoForm({ onChange, showErrors }: Props): React.JSX.Element {
  const [tableName, setTableName] = useState('')
  const [hashKey, setHashKey] = useState('')
  const [billingMode, setBillingMode] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>(
    'PAY_PER_REQUEST'
  )

  const err = showErrors ?? false

  const emit = (tn: string, hk: string, bm: 'PAY_PER_REQUEST' | 'PROVISIONED'): void => {
    onChange({ resource: 'dynamo', tableName: tn, hashKey: hk, billingMode: bm })
  }

  const tableInvalid = err && !tableName.trim()
  const hashInvalid = err && !hashKey.trim()

  return (
    <div className="form-group">
      <div className={'form-field' + (tableInvalid ? ' -invalid' : '')}>
        <span className="label">Table Name</span>
        <input
          className="form-input"
          value={tableName}
          placeholder="my-table"
          onChange={(e) => {
            setTableName(e.target.value)
            emit(e.target.value, hashKey, billingMode)
          }}
        />
      </div>

      <div className={'form-field' + (hashInvalid ? ' -invalid' : '')}>
        <span className="label">Partition Key (Hash Key)</span>
        <input
          className="form-input"
          value={hashKey}
          placeholder="id"
          onChange={(e) => {
            setHashKey(e.target.value)
            emit(tableName, e.target.value, billingMode)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Billing Mode</span>
        <select
          className="form-select"
          value={billingMode}
          onChange={(e) => {
            setBillingMode(e.target.value as 'PAY_PER_REQUEST' | 'PROVISIONED')
            emit(tableName, hashKey, e.target.value as 'PAY_PER_REQUEST' | 'PROVISIONED')
          }}
        >
          <option value="PAY_PER_REQUEST">PAY_PER_REQUEST (on-demand)</option>
          <option value="PROVISIONED">PROVISIONED</option>
        </select>
      </div>
    </div>
  )
}
