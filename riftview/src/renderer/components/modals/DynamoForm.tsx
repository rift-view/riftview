import React, { useState } from 'react'
import type { DynamoParams } from '../../types/create'

interface Props {
  onChange: (p: DynamoParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--ink-900)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--border)'}`,
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--fg)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
})
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
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

  return (
    <div>
      <div style={lbl}>Table Name *</div>
      <input
        style={inp(err && !tableName.trim())}
        value={tableName}
        placeholder="my-table"
        onChange={(e) => {
          setTableName(e.target.value)
          emit(e.target.value, hashKey, billingMode)
        }}
      />

      <div style={lbl}>Partition Key (Hash Key) *</div>
      <input
        style={inp(err && !hashKey.trim())}
        value={hashKey}
        placeholder="id"
        onChange={(e) => {
          setHashKey(e.target.value)
          emit(tableName, e.target.value, billingMode)
        }}
      />

      <div style={lbl}>Billing Mode</div>
      <select
        style={inp(false)}
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
  )
}
