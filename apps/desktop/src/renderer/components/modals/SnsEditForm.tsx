import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { SnsEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SnsEditParams) => void
}

export default function SnsEditForm({ node, onChange }: Props): React.JSX.Element {
  const topicArn = node.id
  const [displayName, setDisplayName] = useState((node.metadata.displayName as string) ?? '')

  const emit = (dn: string): void => onChange({ resource: 'sns', topicArn, displayName: dn })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Topic ARN</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={topicArn} readOnly />
      </div>
      <div className="form-field">
        <span className="label">Display Name (SMS Sender ID)</span>
        <input
          className="form-input"
          type="text"
          maxLength={11}
          value={displayName}
          placeholder="Max 11 characters"
          onChange={(e) => {
            setDisplayName(e.target.value)
            emit(e.target.value)
          }}
        />
      </div>
    </div>
  )
}
