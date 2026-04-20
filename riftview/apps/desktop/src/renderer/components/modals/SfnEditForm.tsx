import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { SfnEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SfnEditParams) => void
}

export default function SfnEditForm({ node, onChange }: Props): React.JSX.Element {
  const [definition, setDefinition] = useState((node.metadata.definition as string) ?? '')
  const [roleArn, setRoleArn] = useState((node.metadata.roleArn as string) ?? '')

  const emit = (def: string, role: string): void =>
    onChange({
      resource: 'sfn',
      stateMachineArn: node.id,
      definition: def || undefined,
      roleArn: role || undefined
    })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">State Machine ARN</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={node.id} readOnly />
      </div>

      <div className="form-field">
        <span className="label">Role ARN</span>
        <input
          className="form-input"
          value={roleArn}
          placeholder="arn:aws:iam::123456789012:role/StepFunctionsRole"
          onChange={(e) => {
            setRoleArn(e.target.value)
            emit(definition, e.target.value)
          }}
        />
      </div>

      <div className="form-field">
        <span className="label">Definition (ASL JSON)</span>
        <textarea
          className="form-textarea"
          style={{ minHeight: 120 }}
          value={definition}
          placeholder='{"Comment":"My state machine","StartAt":"HelloWorld","States":{"HelloWorld":{"Type":"Pass","End":true}}}'
          onChange={(e) => {
            setDefinition(e.target.value)
            emit(e.target.value, roleArn)
          }}
        />
      </div>
    </div>
  )
}
