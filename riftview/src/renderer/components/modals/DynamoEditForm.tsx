import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { DynamoEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: DynamoEditParams) => void
}

const inp: React.CSSProperties = {
  width: '100%',
  background: 'var(--ink-900)',
  border: '1px solid var(--border)',
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--fg)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
}
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--fg-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
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
    <div>
      <div style={lbl}>Table Name</div>
      <input style={{ ...inp, opacity: 0.6 }} value={tableName} readOnly />

      <div style={lbl}>Billing Mode</div>
      <select
        style={inp}
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

      {billingMode === 'PROVISIONED' && (
        <>
          <div style={lbl}>Read Capacity Units</div>
          <input
            style={inp}
            type="number"
            min={1}
            value={readCapacityUnits}
            onChange={(e) => {
              const v = Number(e.target.value)
              setReadCapacityUnits(v)
              emit(billingMode, v, writeCapacityUnits)
            }}
          />
          <div style={lbl}>Write Capacity Units</div>
          <input
            style={inp}
            type="number"
            min={1}
            value={writeCapacityUnits}
            onChange={(e) => {
              const v = Number(e.target.value)
              setWriteCapacityUnits(v)
              emit(billingMode, readCapacityUnits, v)
            }}
          />
        </>
      )}
    </div>
  )
}
