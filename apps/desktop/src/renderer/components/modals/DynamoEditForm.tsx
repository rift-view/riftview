import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { DynamoEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: DynamoEditParams) => void
}

export default function DynamoEditForm({ node, onChange }: Props): React.JSX.Element {
  const tableName = (node.metadata.tableName as string) ?? node.label

  const initialBillingMode: 'PAY_PER_REQUEST' | 'PROVISIONED' =
    (node.metadata.billingMode as string) === 'PROVISIONED' ? 'PROVISIONED' : 'PAY_PER_REQUEST'
  const [billingMode, setBillingMode] = useState<'PAY_PER_REQUEST' | 'PROVISIONED'>(
    initialBillingMode
  )
  const [readCapacityUnits, setReadCapacityUnits] = useState(
    (node.metadata.readCapacity as number) ?? (node.metadata.readCapacityUnits as number) ?? 5
  )
  const [writeCapacityUnits, setWriteCapacityUnits] = useState(
    (node.metadata.writeCapacity as number) ?? (node.metadata.writeCapacityUnits as number) ?? 5
  )

  const emit = (mode: 'PAY_PER_REQUEST' | 'PROVISIONED', rcu: number, wcu: number): void => {
    const params: DynamoEditParams = { resource: 'dynamo', tableName, billingMode: mode }
    if (mode === 'PROVISIONED') {
      params.readCapacityUnits = rcu
      params.writeCapacityUnits = wcu
    }
    onChange(params)
  }

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Table Name</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={tableName} readOnly />
      </div>

      <div className="form-field">
        <span className="label">Billing Mode</span>
        <select
          className="form-select"
          value={billingMode}
          onChange={(e) => {
            const v = e.target.value as 'PAY_PER_REQUEST' | 'PROVISIONED'
            setBillingMode(v)
            emit(v, readCapacityUnits, writeCapacityUnits)
          }}
        >
          <option value="PAY_PER_REQUEST">PAY_PER_REQUEST</option>
          <option value="PROVISIONED">PROVISIONED</option>
        </select>
      </div>

      {billingMode === 'PROVISIONED' && (
        <>
          <div className="form-field">
            <span className="label">Read Capacity Units</span>
            <input
              className="form-input"
              type="number"
              min={1}
              value={readCapacityUnits}
              onChange={(e) => {
                const v = Number(e.target.value)
                setReadCapacityUnits(v)
                emit(billingMode, v, writeCapacityUnits)
              }}
            />
          </div>
          <div className="form-field">
            <span className="label">Write Capacity Units</span>
            <input
              className="form-input"
              type="number"
              min={1}
              value={writeCapacityUnits}
              onChange={(e) => {
                const v = Number(e.target.value)
                setWriteCapacityUnits(v)
                emit(billingMode, readCapacityUnits, v)
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
