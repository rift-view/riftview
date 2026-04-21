import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { EventBridgeEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: EventBridgeEditParams) => void
}

export default function EventBridgeEditForm({ node, onChange }: Props): React.JSX.Element {
  const busName = node.label
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (desc: string): void =>
    onChange({ resource: 'eventbridge-bus', busName, description: desc })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Bus Name</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={busName} readOnly />
      </div>
      <div className="form-field">
        <span className="label">Description (max 512 chars)</span>
        <textarea
          className="form-textarea"
          style={{ minHeight: 60 }}
          value={description}
          maxLength={512}
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
