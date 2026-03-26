import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { SsmEditParams } from '../../types/edit'

interface Props { node: CloudNode; onChange: (p: SsmEditParams) => void }

const inp: React.CSSProperties = {
  width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 10,
  boxSizing: 'border-box' as const,
}
const inpDisabled: React.CSSProperties = { ...inp, opacity: 0.5, cursor: 'not-allowed' }
const lbl: React.CSSProperties = { fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8 }
const notice: React.CSSProperties = {
  fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: 3, padding: '4px 6px', marginTop: 4,
}

export default function SsmEditForm({ node, onChange }: Props): React.JSX.Element {
  const paramName = node.label
  const existingType = (node.metadata.type as string) ?? 'String'
  const isSecure = existingType === 'SecureString'

  const [value, setValue] = useState(isSecure ? '' : ((node.metadata.value as string) ?? ''))
  const [description, setDescription] = useState((node.metadata.description as string) ?? '')

  const emit = (v: string, d: string): void => {
    onChange({ resource: 'ssm-param', paramName, value: v, paramType: existingType, description: d || undefined })
  }

  // Emit initial state on mount
  React.useEffect(() => {
    emit(value, description)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={lbl}>Parameter Name</div>
      <input style={{ ...inp, opacity: 0.6 }} value={paramName} readOnly />

      <div style={lbl}>Type</div>
      <input style={{ ...inp, opacity: 0.6 }} value={existingType} readOnly />

      <div style={lbl}>Value {isSecure ? '' : '*'}</div>
      {isSecure ? (
        <>
          <input style={inpDisabled} value="" placeholder="(SecureString — cannot display)" disabled />
          <div style={notice}>SecureString values cannot be edited here. To rotate a SecureString, use the AWS Console or CLI directly.</div>
        </>
      ) : (
        <input
          style={inp}
          value={value}
          placeholder="parameter value"
          onChange={(e) => { setValue(e.target.value); emit(e.target.value, description) }}
        />
      )}

      <div style={lbl}>Description</div>
      <input
        style={inp}
        value={description}
        placeholder="Optional description"
        onChange={(e) => { setDescription(e.target.value); emit(value, e.target.value) }}
      />
    </div>
  )
}
