import { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SecretEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SecretEditParams) => void
}

export default function SecretEditForm({ node, onChange }: Props): React.JSX.Element {
  const secretId = node.id
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (desc: string): void => onChange({ resource: 'secret', secretId, description: desc })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Secret ID (ARN)</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={secretId} readOnly />
      </div>
      <div className="form-field">
        <span className="label">Description</span>
        <textarea
          className="form-textarea"
          style={{ minHeight: 60 }}
          value={description}
          placeholder="Optional description"
          onChange={(e) => {
            setDescription(e.target.value)
            emit(e.target.value)
          }}
        />
      </div>
    </div>
  )
}
