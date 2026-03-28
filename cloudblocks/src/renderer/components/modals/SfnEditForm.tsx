import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SfnEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SfnEditParams) => void }

const inp: React.CSSProperties = { width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }

export default function SfnEditForm({ node, onChange }: Props): React.JSX.Element {
  const [definition, setDefinition] = useState((node.metadata.definition as string) ?? '')
  const [roleArn, setRoleArn] = useState((node.metadata.roleArn as string) ?? '')

  const emit = (def: string, role: string): void =>
    onChange({ resource: 'sfn', stateMachineArn: node.id, definition: def || undefined, roleArn: role || undefined })

  return (
    <div>
      <div style={lbl}>State Machine ARN</div>
      <input style={{ ...inp, opacity: 0.6 }} value={node.id} readOnly />

      <div style={lbl}>Role ARN</div>
      <input
        style={inp}
        value={roleArn}
        placeholder="arn:aws:iam::123456789012:role/StepFunctionsRole"
        onChange={e => { setRoleArn(e.target.value); emit(definition, e.target.value) }}
      />

      <div style={lbl}>Definition (ASL JSON)</div>
      <textarea
        style={{ ...inp, height: 120, resize: 'vertical' }}
        value={definition}
        placeholder='{"Comment":"My state machine","StartAt":"HelloWorld","States":{"HelloWorld":{"Type":"Pass","End":true}}}'
        onChange={e => { setDefinition(e.target.value); emit(e.target.value, roleArn) }}
      />
    </div>
  )
}
