import React, { useState } from 'react'
import type { SfnParams } from '../../types/create'

interface Props {
  onChange: (p: SfnParams) => void
  showErrors?: boolean
}

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'var(--cb-bg-panel)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3,
  padding: '3px 6px',
  color: 'var(--cb-text-primary)',
  fontFamily: 'monospace',
  fontSize: 10,
  boxSizing: 'border-box' as const
})
const lbl: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--cb-text-muted)',
  textTransform: 'uppercase',
  marginBottom: 2,
  marginTop: 8
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

  const emit = (n: string, t: 'STANDARD' | 'EXPRESS', r: string, d: string): void => {
    onChange({ resource: 'sfn', name: n, type: t, roleArn: r, definition: d })
  }

  return (
    <div>
      <div style={lbl}>State Machine Name *</div>
      <input
        style={inp(err && !name.trim())}
        value={name}
        placeholder="my-state-machine"
        onChange={(e) => {
          setName(e.target.value)
          emit(e.target.value, type, roleArn, definition)
        }}
      />

      <div style={lbl}>Type</div>
      <select
        style={inp(false)}
        value={type}
        onChange={(e) => {
          setType(e.target.value as 'STANDARD' | 'EXPRESS')
          emit(name, e.target.value as 'STANDARD' | 'EXPRESS', roleArn, definition)
        }}
      >
        <option value="STANDARD">STANDARD</option>
        <option value="EXPRESS">EXPRESS</option>
      </select>

      <div style={lbl}>Role ARN *</div>
      <input
        style={inp(err && !roleArn.trim())}
        value={roleArn}
        placeholder="arn:aws:iam::123456789012:role/StepFunctionsRole"
        onChange={(e) => {
          setRoleArn(e.target.value)
          emit(name, type, e.target.value, definition)
        }}
      />

      <div style={lbl}>Definition (ASL JSON) *</div>
      <textarea
        style={{ ...inp(err && !definition.trim()), height: 80, resize: 'vertical' }}
        value={definition}
        onChange={(e) => {
          setDefinition(e.target.value)
          emit(name, type, roleArn, e.target.value)
        }}
      />
    </div>
  )
}
