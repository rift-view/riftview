import { useState } from 'react'
import type { CloudNode } from '@riftview/shared'
import type { SqsEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SqsEditParams) => void
}

export default function SqsEditForm({ node, onChange }: Props): React.JSX.Element {
  const queueUrl = (node.metadata.url as string) ?? node.id
  const [visibilityTimeout, setVisibilityTimeout] = useState(
    (node.metadata.visibilityTimeout as number) ?? 30
  )
  const [messageRetentionPeriod, setMessageRetentionPeriod] = useState(
    (node.metadata.messageRetentionPeriod as number) ?? 345600
  )

  const emit = (vt: number, mrp: number): void =>
    onChange({ resource: 'sqs', queueUrl, visibilityTimeout: vt, messageRetentionPeriod: mrp })

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Queue URL</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={queueUrl} readOnly />
      </div>
      <div className="form-field">
        <span className="label">Visibility Timeout (seconds)</span>
        <input
          className="form-input"
          data-testid="sqs-edit-form-visibility-timeout"
          type="number"
          min={0}
          max={43200}
          value={visibilityTimeout}
          onChange={(e) => {
            const v = Number(e.target.value)
            setVisibilityTimeout(v)
            emit(v, messageRetentionPeriod)
          }}
        />
      </div>
      <div className="form-field">
        <span className="label">Message Retention (seconds)</span>
        <input
          className="form-input"
          type="number"
          min={60}
          max={1209600}
          value={messageRetentionPeriod}
          onChange={(e) => {
            const v = Number(e.target.value)
            setMessageRetentionPeriod(v)
            emit(visibilityTimeout, v)
          }}
        />
      </div>
    </div>
  )
}
