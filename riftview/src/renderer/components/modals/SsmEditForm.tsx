import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SsmEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onChange: (p: SsmEditParams) => void
}

export default function SsmEditForm({ node, onChange }: Props): React.JSX.Element {
  const paramName = node.label
  const existingType = (node.metadata.type as string) ?? 'String'
  const isSecure = existingType === 'SecureString'

  const [value, setValue] = useState(isSecure ? '' : ((node.metadata.value as string) ?? ''))
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (v: string, d: string): void => {
    onChange({
      resource: 'ssm-param',
      paramName,
      value: v,
      paramType: existingType,
      description: d || undefined
    })
  }

  // Emit initial state on mount
  React.useEffect(() => {
    emit(value, description)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="form-group">
      <div className="form-field">
        <span className="label">Parameter Name</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={paramName} readOnly />
      </div>

      <div className="form-field">
        <span className="label">Type</span>
        <input className="form-input" style={{ opacity: 0.6 }} value={existingType} readOnly />
      </div>

      <div className="form-field">
        <span className="label">Value</span>
        {isSecure ? (
          <>
            <input
              className="form-input"
              style={{ opacity: 0.5, cursor: 'not-allowed' }}
              value=""
              placeholder="(SecureString — cannot display)"
              disabled
            />
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-micro)',
                color: 'var(--ember-400)',
                background: 'oklch(0.73 0.170 50 / 0.08)',
                border: '1px solid oklch(0.73 0.170 50 / 0.30)',
                borderLeft: '2px solid var(--ember-500)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                marginTop: 4
              }}
            >
              SecureString values cannot be edited here. To rotate a SecureString, use the AWS
              Console or CLI directly.
            </div>
          </>
        ) : (
          <input
            className="form-input"
            value={value}
            placeholder="parameter value"
            onChange={(e) => {
              setValue(e.target.value)
              emit(e.target.value, description)
            }}
          />
        )}
      </div>

      <div className="form-field">
        <span className="label">Description</span>
        <input
          className="form-input"
          value={description}
          placeholder="Optional description"
          onChange={(e) => {
            setDescription(e.target.value)
            emit(value, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
